package com.anonymous.justbudget

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Handles adding and undoing transactions purely in the background via Android broadcasts.
 * Zero UI, writes directly to SQLite (just_budget.db), and delivers an actionable notification.
 *
 * Example ADB trigger:
 * adb shell am broadcast -a com.anonymous.justbudget.ADD_TRANSACTION -p com.anonymous.justbudget \
 *   --es amount "4500" --es type "expense" --es category "Food" --es note "Lunch"
 */
class TransactionBroadcastReceiver : BroadcastReceiver() {

  companion object {
    private const val TAG = "JustBudgetReceiver"
    const val ACTION_ADD_TRANSACTION = "com.anonymous.justbudget.ADD_TRANSACTION"
    const val ACTION_UNDO_TRANSACTION = "com.anonymous.justbudget.UNDO_TRANSACTION"
    private const val CHANNEL_ID = "just_budget_transactions"
    private const val CHANNEL_NAME = "Quick Transactions"
  }

  override fun onReceive(context: Context, intent: Intent?) {
    if (intent == null) return

    when (intent.action) {
      ACTION_ADD_TRANSACTION -> handleAddTransaction(context, intent)
      ACTION_UNDO_TRANSACTION -> handleUndoTransaction(context, intent)
      else -> Log.d(TAG, "Unhandled broadcast action: ${intent.action}")
    }
  }

  private fun handleAddTransaction(context: Context, intent: Intent) {
    val amount = parseAmount(intent)
    if (amount <= 0.0) {
      Log.w(TAG, "Cannot add transaction with invalid amount: $amount")
      return
    }

    val typeRaw = intent.getStringExtra("type") ?: "expense"
    val type = if (typeRaw.equals("income", ignoreCase = true)) "income" else "expense"
    val rawCategory = intent.getStringExtra("category") ?: intent.getStringExtra("recipient")
    val rawSubcategory = intent.getStringExtra("subcategory")
    val note = intent.getStringExtra("note") ?: intent.getStringExtra("description") ?: ""
    val rawWallet = intent.getStringExtra("wallet")
    val dateOverride = intent.getStringExtra("date")

    val dbFile = resolveDatabaseFile(context)
    if (!dbFile.exists()) {
      Log.e(TAG, "Database just_budget.db does not exist at ${dbFile.absolutePath}")
      return
    }

    var db: SQLiteDatabase? = null
    try {
      db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)
      db.beginTransaction()

      // 1. Resolve Wallet
      var walletId = ""
      var walletCurrency = "TZS"
      if (!rawWallet.isNullOrBlank()) {
        val wCursor = db.rawQuery(
          "SELECT id, currency FROM wallets WHERE id = ? OR name = ? COLLATE NOCASE LIMIT 1",
          arrayOf(rawWallet.trim(), rawWallet.trim())
        )
        if (wCursor.moveToFirst()) {
          walletId = wCursor.getString(0)
          walletCurrency = wCursor.getString(1)
        }
        wCursor.close()
      }

      if (walletId.isEmpty()) {
        val defCursor = db.rawQuery(
          "SELECT id, currency FROM wallets ORDER BY is_default DESC, rowid ASC LIMIT 1",
          null
        )
        if (defCursor.moveToFirst()) {
          walletId = defCursor.getString(0)
          walletCurrency = defCursor.getString(1)
        }
        defCursor.close()
      }

      if (walletId.isEmpty()) {
        Log.e(TAG, "No wallets found in database to associate transaction")
        return
      }

      // 2. Resolve Category and Subcategory
      var categoryId: String? = null
      var subcategoryId: String? = null
      var categoryDisplayName = if (type == "income") "Income" else "Expense"

      val queryCat = rawCategory?.trim()
      val queryNote = note.trim()

      // Function to attempt matching category/subcategory
      fun resolveCategoryMatch(query: String?): Boolean {
        if (query.isNullOrBlank()) return false
        val qLower = query.lowercase(Locale.getDefault())

        // Exact match
        val cCursor = db.rawQuery(
          "SELECT id, name FROM categories WHERE (type = ? OR type IS NULL) AND (id = ? OR LOWER(name) = ?) LIMIT 1",
          arrayOf(type, query, qLower)
        )
        if (cCursor.moveToFirst()) {
          categoryId = cCursor.getString(0)
          categoryDisplayName = cCursor.getString(1)
          cCursor.close()
          return true
        }
        cCursor.close()

        // Partial match (e.g. "Food" -> "Food & Dining")
        val pCursor = db.rawQuery(
          "SELECT id, name FROM categories WHERE (type = ? OR type IS NULL) AND (LOWER(name) LIKE ? OR ? LIKE '%' || LOWER(name) || '%') LIMIT 1",
          arrayOf(type, "%$qLower%", qLower)
        )
        if (pCursor.moveToFirst()) {
          categoryId = pCursor.getString(0)
          categoryDisplayName = pCursor.getString(1)
          pCursor.close()
          return true
        }
        pCursor.close()

        // Subcategory match
        val sCursor = db.rawQuery(
          "SELECT s.id, s.category_id, c.name FROM subcategories s JOIN categories c ON s.category_id = c.id WHERE (c.type = ? OR c.type IS NULL) AND (LOWER(s.name) = ? OR LOWER(s.name) LIKE ?) LIMIT 1",
          arrayOf(type, qLower, "%$qLower%")
        )
        if (sCursor.moveToFirst()) {
          subcategoryId = sCursor.getString(0)
          categoryId = sCursor.getString(1)
          categoryDisplayName = sCursor.getString(2)
          sCursor.close()
          return true
        }
        sCursor.close()

        return false
      }

      if (!resolveCategoryMatch(queryCat)) {
        // Fallback: check note
        resolveCategoryMatch(queryNote)
      } else if (categoryId != null && subcategoryId == null && queryNote.isNotBlank()) {
        // Try finding subcategory under matched category from note
        val sCursor = db.rawQuery(
          "SELECT id FROM subcategories WHERE category_id = ? AND (LOWER(name) = ? OR LOWER(name) LIKE ?) LIMIT 1",
          arrayOf(categoryId, queryNote.lowercase(Locale.getDefault()), "%${queryNote.lowercase(Locale.getDefault())}%")
        )
        if (sCursor.moveToFirst()) {
          subcategoryId = sCursor.getString(0)
        }
        sCursor.close()
      }

      // Explicit subcategory override if given
      if (!rawSubcategory.isNullOrBlank() && categoryId != null) {
        val sCursor = db.rawQuery(
          "SELECT id FROM subcategories WHERE category_id = ? AND (id = ? OR LOWER(name) = ?) LIMIT 1",
          arrayOf(categoryId, rawSubcategory.trim(), rawSubcategory.trim().lowercase(Locale.getDefault()))
        )
        if (sCursor.moveToFirst()) {
          subcategoryId = sCursor.getString(0)
        }
        sCursor.close()
      }

      // 3. Generate Timestamps & IDs
      val now = Date()
      val dateStr = if (!dateOverride.isNullOrBlank()) dateOverride else SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(now)
      val timeStr = SimpleDateFormat("HH:mm", Locale.getDefault()).format(now)
      val txId = "tx_${System.currentTimeMillis()}_${UUID.randomUUID().toString().substring(0, 6)}"
      val createdAtStr = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).format(now)

      // 4. Insert Transaction Record
      db.execSQL(
        """
        INSERT INTO transactions (
          id, wallet_id, category_id, subcategory_id, type, amount, currency,
          base_amount, date, time, note, is_paid, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """.trimIndent(),
        arrayOf(
          txId,
          walletId,
          categoryId,
          subcategoryId,
          type,
          amount,
          walletCurrency,
          amount,
          dateStr,
          timeStr,
          if (note.isBlank()) null else note,
          createdAtStr
        )
      )

      // 5. Update Wallet Balance
      if (type == "expense") {
        db.execSQL("UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?", arrayOf(amount, walletId))
      } else {
        db.execSQL("UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?", arrayOf(amount, walletId))
      }

      db.setTransactionSuccessful()
      Log.i(TAG, "Background transaction $txId recorded successfully: $amount $walletCurrency ($type)")

      // 6. Post Confirmation Notification with Undo Button
      postNotification(context, txId, type, amount, walletCurrency, categoryDisplayName, note)

    } catch (e: Exception) {
      Log.e(TAG, "Error recording background transaction", e)
    } finally {
      try {
        db?.endTransaction()
        db?.close()
      } catch (_: Exception) {}
    }
  }

  private fun handleUndoTransaction(context: Context, intent: Intent) {
    val txId = intent.getStringExtra("txId") ?: return
    val dbFile = resolveDatabaseFile(context)
    if (!dbFile.exists()) return

    var db: SQLiteDatabase? = null
    try {
      db = SQLiteDatabase.openDatabase(dbFile.absolutePath, null, SQLiteDatabase.OPEN_READWRITE)
      db.beginTransaction()

      val cursor = db.rawQuery(
        "SELECT wallet_id, type, amount FROM transactions WHERE id = ? LIMIT 1",
        arrayOf(txId)
      )

      if (cursor.moveToFirst()) {
        val walletId = cursor.getString(0)
        val type = cursor.getString(1)
        val amount = cursor.getDouble(2)
        cursor.close()

        // Delete transaction
        db.execSQL("DELETE FROM transactions WHERE id = ?", arrayOf(txId))

        // Revert wallet balance
        if (type == "expense") {
          db.execSQL("UPDATE wallets SET current_balance = current_balance + ? WHERE id = ?", arrayOf(amount, walletId))
        } else {
          db.execSQL("UPDATE wallets SET current_balance = current_balance - ? WHERE id = ?", arrayOf(amount, walletId))
        }

        db.setTransactionSuccessful()
        Log.i(TAG, "Transaction $txId undone successfully")

        // Cancel notification and show undone alert
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(txId.hashCode())

        showUndoneNotification(context, amount, type)
      } else {
        cursor.close()
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error undoing transaction $txId", e)
    } finally {
      try {
        db?.endTransaction()
        db?.close()
      } catch (_: Exception) {}
    }
  }

  private fun parseAmount(intent: Intent): Double {
    if (intent.hasExtra("amount")) {
      val doubleVal = intent.getDoubleExtra("amount", -1.0)
      if (doubleVal > 0.0) return doubleVal

      val floatVal = intent.getFloatExtra("amount", -1.0f)
      if (floatVal > 0.0f) return floatVal.toDouble()

      val strVal = intent.getStringExtra("amount")
      if (!strVal.isNullOrBlank()) {
        val clean = strVal.replace("[^0-9.]".toRegex(), "")
        return clean.toDoubleOrNull() ?: 0.0
      }
    }
    return 0.0
  }

  private fun postNotification(
    context: Context,
    txId: String,
    type: String,
    amount: Double,
    currency: String,
    categoryName: String,
    note: String
  ) {
    createNotificationChannel(context)

    val formattedAmount = formatNumber(amount)
    val title = if (type == "expense") "Expense Recorded" else "Income Recorded"
    val content = buildString {
      append("$formattedAmount $currency • $categoryName")
      if (note.isNotBlank()) {
        append(" (\"$note\")")
      }
    }

    // Undo intent
    val undoIntent = Intent(context, TransactionBroadcastReceiver::class.java).apply {
      action = ACTION_UNDO_TRANSACTION
      putExtra("txId", txId)
    }
    val undoPendingIntent = PendingIntent.getBroadcast(
      context,
      txId.hashCode(),
      undoIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // Open App intent on notification tap
    val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val openPendingIntent = openAppIntent?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_more)
      .setContentTitle(title)
      .setContentText(content)
      .setStyle(NotificationCompat.BigTextStyle().bigText(content))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(openPendingIntent)
      .addAction(android.R.drawable.ic_menu_revert, "Undo", undoPendingIntent)
      .build()

    try {
      NotificationManagerCompat.from(context).notify(txId.hashCode(), notification)
    } catch (e: SecurityException) {
      Log.w(TAG, "Notification permission not granted to display transaction confirmation", e)
    }
  }

  private fun showUndoneNotification(context: Context, amount: Double, type: String) {
    val title = "Transaction Reverted"
    val text = "Cancelled ${formatNumber(amount)} ($type)"
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_more)
      .setContentTitle(title)
      .setContentText(text)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setAutoCancel(true)
      .setTimeoutAfter(4000)
      .build()

    try {
      NotificationManagerCompat.from(context).notify(99999, notification)
    } catch (_: SecurityException) {}
  }

  private fun createNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Confirmations for background and assistant transactions"
        enableVibration(true)
      }
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }
  }

  private fun formatNumber(num: Double): String {
    return try {
      val nf = NumberFormat.getInstance(Locale.US)
      nf.maximumFractionDigits = 2
      nf.minimumFractionDigits = if (num % 1.0 == 0.0) 0 else 2
      nf.format(num)
    } catch (_: Exception) {
      num.toString()
    }
  }

  private fun resolveDatabaseFile(context: Context): java.io.File {
    val candidates = listOf(
      java.io.File(java.io.File(context.filesDir, "SQLite"), "just_budget.db"),
      context.getDatabasePath("just_budget.db"),
      java.io.File(context.filesDir, "just_budget.db")
    )
    return candidates.firstOrNull { it.exists() } ?: candidates.first()
  }
}

