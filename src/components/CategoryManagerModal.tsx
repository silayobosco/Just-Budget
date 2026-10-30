import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { Category, Subcategory, BudgetProgress, BudgetScope } from '../types';
import { formatCurrency, formatTypingNumber } from '../utils/format';

interface CategoryManagerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({ visible, onClose }) => {
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    budgets,
    setBudgetLimit,
    deleteBudgetLimit,
    categoryBudgetProgressList,
    overallBudgetLimit,
    overallBudgetSpent,
    allocatedCategoriesBudget,
    unallocatedBudgetRemainder,
    settings,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
  const curr = settings.base_currency;

  const [filterType, setFilterType] = useState<'expense' | 'income'>('expense');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // Form states for Category
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('tag-outline');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [newCatLimitStr, setNewCatLimitStr] = useState('');

  // Subcategory form states
  const [newSubName, setNewSubName] = useState('');
  const [newSubLimitStr, setNewSubLimitStr] = useState('');
  const [activeSubInputCatId, setActiveSubInputCatId] = useState<string | null>(null);

  // Edit Limit Dialog state (for quick inline limit changes)
  const [editLimitVisible, setEditLimitVisible] = useState(false);
  const [editLimitScope, setEditLimitScope] = useState<BudgetScope>('category');
  const [editLimitTargetId, setEditLimitTargetId] = useState<string>('');
  const [editLimitParentCatId, setEditLimitParentCatId] = useState<string>('');
  const [editLimitTargetName, setEditLimitTargetName] = useState<string>('');
  const [editLimitAmountStr, setEditLimitAmountStr] = useState<string>('');
  const [editLimitMaxAllowed, setEditLimitMaxAllowed] = useState<number | null>(null);

  // Edit Subcategory Modal state
  const [editingSubModalVisible, setEditingSubModalVisible] = useState(false);
  const [editingSubParentCat, setEditingSubParentCat] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubLimitStr, setEditSubLimitStr] = useState('');

  const parentCatLimit = useMemo(() => {
    if (!editingSubParentCat) return 0;
    const p = categoryBudgetProgressList.find((c) => c.id === editingSubParentCat.id);
    return p?.limit || 0;
  }, [editingSubParentCat, categoryBudgetProgressList]);

  // Expanded subcategories per category
  const [expandedCatIds, setExpandedCatIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (catId: string) => {
    setExpandedCatIds((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const colors = [
    '#FF6F61', '#3B82F6', '#F59E0B', '#8B5CF6', '#10B981',
    '#EC4899', '#06B6D4', '#84CC16', '#6366F1', '#D97706',
  ];

  const icons: (keyof typeof MaterialCommunityIcons.glyphMap)[] = [
    'silverware-fork-knife', 'home-outline', 'car-outline', 'shopping-outline',
    'gamepad-variant-outline', 'heart-pulse', 'cash-plus', 'coffee-outline',
    'airplane', 'school-outline', 'book-open-outline', 'gift-outline',
    'briefcase-outline', 'bank-outline', 'cellphone', 'dumbbell',
  ];

  const handleStartAdd = () => {
    setEditingCategory(null);
    setNewCatName('');
    setNewCatIcon('tag-outline');
    setNewCatColor(colors[Math.floor(Math.random() * colors.length)]);
    setNewCatLimitStr('');
    setIsAddingNew(true);
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setNewCatName(cat.name);
    setNewCatIcon(cat.icon);
    setNewCatColor(cat.color);

    // Look up current limit
    const catProgress = categoryBudgetProgressList.find((c) => c.id === cat.id);
    setNewCatLimitStr(catProgress && catProgress.limit > 0 ? catProgress.limit.toString() : '');
    setIsAddingNew(false);
  };

  const handleDeleteCategory = (catId: string, catName: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${catName}"? Associated transactions will keep their records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(catId);
            setEditingCategory(null);
            setIsAddingNew(false);
          },
        },
      ]
    );
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return;

    const limitVal = parseFloat(newCatLimitStr.replace(/,/g, '').trim()) || 0;

    if (editingCategory) {
      await updateCategory({
        ...editingCategory,
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
      });

      if (filterType === 'expense') {
        await setBudgetLimit({
          scope: 'category',
          category_id: editingCategory.id,
          amount: limitVal,
        });
      }

      setEditingCategory(null);
    } else {
      const createdId = await addCategory({
        name: newCatName.trim(),
        type: filterType,
        icon: newCatIcon,
        color: newCatColor,
        initial_limit: filterType === 'expense' ? limitVal : undefined,
      });

      setIsAddingNew(false);
    }

    setNewCatName('');
    setNewCatLimitStr('');
  };

  const handleAddSub = async (catId: string) => {
    if (!newSubName.trim()) return;

    const subLimitVal = parseFloat(newSubLimitStr.replace(/,/g, '').trim()) || 0;

    // Check if parent category has a limit and subcategory limit exceeds it
    if (filterType === 'expense' && subLimitVal > 0) {
      const catProgress = categoryBudgetProgressList.find((c) => c.id === catId);
      if (catProgress && catProgress.limit > 0 && subLimitVal > catProgress.limit) {
        Alert.alert(
          'Limit Exceeded',
          `Subcategory limit cannot exceed the parent category budget of ${formatCurrency(catProgress.limit, curr)}.`
        );
        return;
      }
    }

    await addSubcategory(catId, newSubName.trim(), filterType === 'expense' ? subLimitVal : undefined);
    setNewSubName('');
    setNewSubLimitStr('');
    setActiveSubInputCatId(null);
  };

  const handleStartEditSub = (cat: Category, sub: Subcategory) => {
    setEditingSubParentCat(cat);
    setEditingSubcategory(sub);
    setEditSubName(sub.name);

    // Look up current subcategory limit
    const catProgress = categoryBudgetProgressList.find((c) => c.id === cat.id);
    const subProgress = catProgress?.subBudgets?.find((s) => s.id === sub.id);
    setEditSubLimitStr(subProgress && subProgress.limit > 0 ? subProgress.limit.toString() : '');

    setEditingSubModalVisible(true);
  };

  const handleSaveSubcategory = async () => {
    if (!editingSubcategory || !editSubName.trim()) return;

    // 1. Update subcategory name
    await updateSubcategory(editingSubcategory.id, editSubName.trim());

    // 2. If expense, update or clear budget limit
    if (filterType === 'expense' && editingSubParentCat) {
      const limitVal = parseFloat(editSubLimitStr.replace(/,/g, '').trim()) || 0;
      await setBudgetLimit({
        scope: 'subcategory',
        category_id: editingSubParentCat.id,
        subcategory_id: editingSubcategory.id,
        amount: limitVal,
      });
    }

    setEditingSubModalVisible(false);
    setEditingSubcategory(null);
    setEditingSubParentCat(null);
  };

  const handleDeleteSubcategory = (subId: string, subName: string) => {
    Alert.alert(
      'Delete Subcategory',
      `Are you sure you want to delete "${subName}"? Associated transactions will keep their records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSubcategory(subId);
            setEditingSubModalVisible(false);
            setEditingSubcategory(null);
            setEditingSubParentCat(null);
          },
        },
      ]
    );
  };

  // Quick edit limit dialog openers
  const openEditCategoryLimit = (cat: Category) => {
    const catProgress = categoryBudgetProgressList.find((c) => c.id === cat.id);
    setEditLimitScope('category');
    setEditLimitTargetId(cat.id);
    setEditLimitParentCatId('');
    setEditLimitTargetName(cat.name);
    setEditLimitAmountStr(catProgress && catProgress.limit > 0 ? catProgress.limit.toString() : '');
    setEditLimitMaxAllowed(overallBudgetLimit > 0 ? overallBudgetLimit : null);
    setEditLimitVisible(true);
  };

  const openEditSubLimit = (cat: Category, subId: string, subName: string) => {
    const catProgress = categoryBudgetProgressList.find((c) => c.id === cat.id);
    const subProgress = catProgress?.subBudgets?.find((s) => s.id === subId);
    setEditLimitScope('subcategory');
    setEditLimitTargetId(subId);
    setEditLimitParentCatId(cat.id);
    setEditLimitTargetName(`${cat.name} › ${subName}`);
    setEditLimitAmountStr(subProgress && subProgress.limit > 0 ? subProgress.limit.toString() : '');
    setEditLimitMaxAllowed(catProgress && catProgress.limit > 0 ? catProgress.limit : null);
    setEditLimitVisible(true);
  };

  const openEditOverallLimit = () => {
    setEditLimitScope('overall');
    setEditLimitTargetId('overall');
    setEditLimitParentCatId('');
    setEditLimitTargetName('Overall Target Budget');
    setEditLimitAmountStr(overallBudgetLimit > 0 ? overallBudgetLimit.toString() : '');
    setEditLimitMaxAllowed(null);
    setEditLimitVisible(true);
  };

  const handleSaveInlineLimit = async () => {
    const rawVal = editLimitAmountStr.replace(/,/g, '').trim();
    const amount = rawVal === '' ? 0 : parseFloat(rawVal);

    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount or 0 to clear.');
      return;
    }

    if (
      editLimitScope === 'subcategory' &&
      editLimitMaxAllowed !== null &&
      editLimitMaxAllowed > 0 &&
      amount > editLimitMaxAllowed
    ) {
      Alert.alert(
        'Subcategory Limit Exceeded',
        `A subcategory limit cannot exceed its category limit of ${formatCurrency(editLimitMaxAllowed, curr)}.`
      );
      return;
    }

    if (editLimitScope === 'overall') {
      await setBudgetLimit({ scope: 'overall', amount });
    } else if (editLimitScope === 'category') {
      await setBudgetLimit({ scope: 'category', category_id: editLimitTargetId, amount });
    } else if (editLimitScope === 'subcategory') {
      await setBudgetLimit({
        scope: 'subcategory',
        category_id: editLimitParentCatId,
        subcategory_id: editLimitTargetId,
        amount,
      });
    }

    setEditLimitVisible(false);
  };

  const handleClearInlineLimit = async () => {
    if (editLimitScope === 'overall') {
      await setBudgetLimit({ scope: 'overall', amount: 0 });
    } else if (editLimitScope === 'category') {
      await setBudgetLimit({ scope: 'category', category_id: editLimitTargetId, amount: 0 });
    } else if (editLimitScope === 'subcategory') {
      await setBudgetLimit({
        scope: 'subcategory',
        category_id: editLimitParentCatId,
        subcategory_id: editLimitTargetId,
        amount: 0,
      });
    }

    setEditLimitVisible(false);
  };

  const filteredCategories = categories.filter((c) => c.type === filterType);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.onSurface }]}>Category & Budget Manager</Text>
              <Text style={[styles.headerSubtitle, { color: theme.onSurfaceVariant }]}>
                Envelopes, categories & spending limits
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}>
              <MaterialCommunityIcons name="close" size={20} color={theme.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Filter Expense / Income Tabs */}
          <View style={[styles.filterBar, { backgroundColor: theme.pillBg }]}>
            <TouchableOpacity
              style={[styles.filterPill, filterType === 'expense' && { backgroundColor: theme.primaryContainer }]}
              onPress={() => setFilterType('expense')}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: filterType === 'expense' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                    fontWeight: filterType === 'expense' ? '700' : '500',
                  },
                ]}
              >
                Expense Budgets
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, filterType === 'income' && { backgroundColor: theme.primaryContainer }]}
              onPress={() => setFilterType('income')}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: filterType === 'income' ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                    fontWeight: filterType === 'income' ? '700' : '500',
                  },
                ]}
              >
                Income Sources
              </Text>
            </TouchableOpacity>
          </View>

          {/* Context Banner: Overall Budget & Envelope Remainder for Expenses */}
          {filterType === 'expense' && (
            <View
              style={[
                styles.overviewBanner,
                allocatedCategoriesBudget > overallBudgetLimit && overallBudgetLimit > 0
                  ? { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }
                  : { backgroundColor: theme.cardBg, borderColor: theme.divider },
                M3Elevation.level1,
              ]}
            >
              <View style={styles.overviewTopRow}>
                <View>
                  <Text style={[styles.overviewLabel, { color: theme.onSurfaceVariant }]}>
                    OVERALL SPENDING BUDGET
                  </Text>
                  <Text style={[styles.overviewAmount, { color: theme.primary }]}>
                    {overallBudgetLimit > 0 ? formatCurrency(overallBudgetLimit, curr) : 'No limit set'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.editOverallBtn, { backgroundColor: theme.primaryContainer }]}
                  onPress={openEditOverallLimit}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={14} color={theme.onPrimaryContainer} />
                  <Text style={[styles.editOverallBtnText, { color: theme.onPrimaryContainer }]}>Edit</Text>
                </TouchableOpacity>
              </View>

              {overallBudgetLimit > 0 && (
                <View style={[styles.overviewProgressBg, { backgroundColor: theme.surfaceVariant }]}>
                  <View
                    style={[
                      styles.overviewProgressFill,
                      {
                        width: `${Math.min(100, Math.round((overallBudgetSpent / overallBudgetLimit) * 100))}%`,
                        backgroundColor:
                          overallBudgetSpent > overallBudgetLimit
                            ? theme.error
                            : (overallBudgetSpent / overallBudgetLimit) * 100 >= 80
                            ? '#D97706'
                            : theme.primary,
                      },
                    ]}
                  />
                </View>
              )}

              <View style={styles.overviewStatsRow}>
                <Text style={[styles.overviewStatText, { color: theme.onSurfaceVariant }]}>
                  Envelopes: <Text style={{ fontWeight: '700' }}>{formatCurrency(allocatedCategoriesBudget, curr)}</Text>
                </Text>
                <Text
                  style={[
                    styles.overviewStatText,
                    {
                      color:
                        allocatedCategoriesBudget > overallBudgetLimit && overallBudgetLimit > 0
                          ? theme.error
                          : theme.success,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {allocatedCategoriesBudget > overallBudgetLimit && overallBudgetLimit > 0
                    ? `Over-allocated by ${formatCurrency(allocatedCategoriesBudget - overallBudgetLimit, curr)}`
                    : `Unallocated: ${formatCurrency(unallocatedBudgetRemainder, curr)}`}
                </Text>
              </View>
            </View>
          )}

          {/* Add / Edit Category Form */}
          {(isAddingNew || editingCategory) && (
            <View style={[styles.editorBox, { backgroundColor: theme.cardBg, borderColor: theme.outlineVariant }]}>
              <Text style={[styles.editorTitle, { color: theme.onSurface }]}>
                {editingCategory ? `Edit "${editingCategory.name}"` : 'New Category'}
              </Text>

              <TextInput
                style={[styles.nameInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                placeholder="Category Name"
                placeholderTextColor={theme.onSurfaceVariant}
                value={newCatName}
                onChangeText={setNewCatName}
              />

              {/* Monthly Budget Limit Input (for Expenses) */}
              {filterType === 'expense' && (
                <View style={styles.limitFormSection}>
                  <View style={styles.limitLabelRow}>
                    <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>Monthly Spending Limit</Text>
                    {unallocatedBudgetRemainder > 0 && (
                      <Text style={[styles.unallocatedHint, { color: theme.primary }]}>
                        ({formatCurrency(unallocatedBudgetRemainder, curr)} unallocated)
                      </Text>
                    )}
                  </View>
                  <View style={[styles.limitInputWrap, { backgroundColor: theme.pillBg }]}>
                    <Text style={[styles.limitInputPrefix, { color: theme.onSurfaceVariant }]}>{curr}</Text>
                    <TextInput
                      style={[styles.limitInput, { color: theme.onSurface }]}
                      placeholder="0.00 (optional limit)"
                      placeholderTextColor={theme.outline}
                      keyboardType="numeric"
                      value={newCatLimitStr}
                      onChangeText={setNewCatLimitStr}
                    />
                  </View>
                </View>
              )}

              {/* Color Palette */}
              <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>Color</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {colors.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      newCatColor === c && { borderWidth: 3, borderColor: theme.onSurface },
                    ]}
                    onPress={() => setNewCatColor(c)}
                  />
                ))}
              </ScrollView>

              {/* Icon Selector */}
              <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {icons.map((ic) => (
                  <TouchableOpacity
                    key={ic}
                    style={[
                      styles.iconCircle,
                      { backgroundColor: newCatIcon === ic ? newCatColor : theme.pillBg },
                    ]}
                    onPress={() => setNewCatIcon(ic)}
                  >
                    <MaterialCommunityIcons
                      name={ic}
                      size={20}
                      color={newCatIcon === ic ? '#FFFFFF' : theme.onSurface}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.editorActionRow}>
                {editingCategory && (
                  <TouchableOpacity
                    style={[styles.deleteCatBtn, { backgroundColor: theme.errorContainer }]}
                    onPress={() => handleDeleteCategory(editingCategory.id, editingCategory.name)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.onErrorContainer} />
                    <Text style={[styles.deleteCatBtnText, { color: theme.onErrorContainer }]}>Delete Category</Text>
                  </TouchableOpacity>
                )}

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: theme.pillBg }]}
                  onPress={() => {
                    setIsAddingNew(false);
                    setEditingCategory(null);
                  }}
                >
                  <Text style={[styles.btnText, { color: theme.onSurface }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveCategory}
                >
                  <Text style={[styles.btnText, { color: theme.onPrimary }]}>
                    {editingCategory ? 'Update' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Category List */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {filteredCategories.map((cat) => {
              const catProgress = categoryBudgetProgressList.find((c) => c.id === cat.id);
              const hasLimit = catProgress && catProgress.limit > 0;
              const isExpanded = Boolean(expandedCatIds[cat.id]);
              const isAddingSubHere = activeSubInputCatId === cat.id;

              let statusColor = theme.onSurfaceVariant;
              let statusText = 'No limit';
              if (hasLimit) {
                if (catProgress.isOverBudget) {
                  statusColor = theme.error;
                  statusText = `Over by ${formatCurrency(catProgress.spent - catProgress.limit, curr)}`;
                } else if (catProgress.isNearLimit) {
                  statusColor = '#D97706';
                  statusText = `${Math.round(catProgress.percent)}% used`;
                } else {
                  statusColor = theme.success;
                  statusText = `${formatCurrency(catProgress.remaining, curr)} left`;
                }
              }

              return (
                <View
                  key={cat.id}
                  style={[styles.categoryCard, { backgroundColor: theme.cardBg, borderColor: theme.divider }]}
                >
                  {/* Category Header */}
                  <View style={styles.catHeader}>
                    <View style={[styles.catIconWrap, { backgroundColor: cat.color }]}>
                      <MaterialCommunityIcons name={cat.icon as any} size={20} color="#FFFFFF" />
                    </View>

                    <View style={styles.catDetails}>
                      <View style={styles.catNameRow}>
                        <Text style={[styles.catName, { color: theme.onSurface }]}>{cat.name}</Text>
                        {filterType === 'expense' && (
                          <Text style={[styles.catStatusText, { color: statusColor }]}>{statusText}</Text>
                        )}
                      </View>

                      {filterType === 'expense' ? (
                        <View style={styles.budgetRow}>
                          <Text style={[styles.catSpentText, { color: theme.onSurfaceVariant }]}>
                            Spent: {formatCurrency(catProgress?.spent || 0, curr)}
                            {hasLimit ? ` / ${formatCurrency(catProgress.limit, curr)}` : ''}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.catSubCount, { color: theme.onSurfaceVariant }]}>
                          {cat.subcategories?.length || 0} subcategories
                        </Text>
                      )}

                      {/* Category Budget Progress Bar */}
                      {filterType === 'expense' && hasLimit && (
                        <View style={[styles.catProgressBg, { backgroundColor: theme.surfaceVariant }]}>
                          <View
                            style={[
                              styles.catProgressFill,
                              {
                                width: `${Math.min(100, Math.round(catProgress.percent))}%`,
                                backgroundColor: catProgress.isOverBudget
                                  ? theme.error
                                  : catProgress.isNearLimit
                                  ? '#D97706'
                                  : cat.color,
                              },
                            ]}
                          />
                        </View>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={styles.catActions}>
                      <TouchableOpacity
                        onPress={() => handleStartEdit(cat)}
                        style={[styles.smallIconBtn, { backgroundColor: theme.pillBg }]}
                        accessibilityLabel="Edit Category"
                      >
                        <MaterialCommunityIcons name="pencil" size={16} color={theme.onSurface} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Subcategories Toggle */}
                  <View style={styles.subToggleRow}>
                    <TouchableOpacity
                      style={styles.subToggleBtn}
                      onPress={() => toggleExpand(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.subToggleText, { color: theme.primary }]}>
                        {isExpanded
                          ? 'Hide Subcategories'
                          : `Subcategories (${cat.subcategories?.length || 0})`}
                      </Text>
                      <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.primary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.addSubToggleBtn, { backgroundColor: theme.pillBg }]}
                      onPress={() => {
                        setActiveSubInputCatId(isAddingSubHere ? null : cat.id);
                        if (!isExpanded) toggleExpand(cat.id);
                      }}
                    >
                      <MaterialCommunityIcons name="plus" size={14} color={theme.primary} />
                      <Text style={[styles.addSubToggleBtnText, { color: theme.primary }]}>Add Sub</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Expanded Subcategories */}
                  {isExpanded && (
                    <View style={[styles.subSection, { borderTopColor: theme.divider }]}>
                      {cat.subcategories?.map((sub) => {
                        const subProgress = catProgress?.subBudgets?.find((s) => s.id === sub.id);
                        const subHasLimit = subProgress && subProgress.limit > 0;

                        return (
                          <View key={sub.id} style={[styles.subItemRow, { backgroundColor: theme.pillBg }]}>
                            <View style={styles.subMainInfo}>
                              <View style={styles.subTitleRow}>
                                <Text style={[styles.subItemName, { color: theme.onSurface }]}>{sub.name}</Text>
                                {filterType === 'expense' && subHasLimit && (
                                  <Text
                                    style={[
                                      styles.subLimitBadgeText,
                                      { color: subProgress.isOverBudget ? theme.error : theme.primary },
                                    ]}
                                  >
                                    Limit: {formatCurrency(subProgress.limit, curr)}
                                  </Text>
                                )}
                              </View>

                              {filterType === 'expense' && (
                                <Text style={[styles.subSpentText, { color: theme.onSurfaceVariant }]}>
                                  Spent: {formatCurrency(subProgress?.spent || 0, curr)}
                                  {subHasLimit ? ` (${Math.round(subProgress.percent)}%)` : ' • No limit'}
                                </Text>
                              )}

                              {filterType === 'expense' && subHasLimit && (
                                <View style={[styles.subProgressBg, { backgroundColor: theme.surfaceVariant }]}>
                                  <View
                                    style={[
                                      styles.subProgressFill,
                                      {
                                        width: `${Math.min(100, Math.round(subProgress.percent))}%`,
                                        backgroundColor: subProgress.isOverBudget
                                          ? theme.error
                                          : subProgress.isNearLimit
                                          ? '#D97706'
                                          : theme.primary,
                                      },
                                    ]}
                                  />
                                </View>
                              )}
                            </View>

                            <View style={styles.subItemActions}>
                              <TouchableOpacity
                                style={[styles.subIconBtn, { backgroundColor: theme.surface }]}
                                onPress={() => handleStartEditSub(cat, sub)}
                                accessibilityLabel="Edit Subcategory"
                              >
                                <MaterialCommunityIcons name="pencil-outline" size={14} color={theme.onSurface} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}

                      {/* Add Subcategory Inline Input Form */}
                      {isAddingSubHere && (
                        <View style={[styles.addSubBox, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
                          <Text style={[styles.addSubBoxTitle, { color: theme.onSurface }]}>New Subcategory</Text>
                          <TextInput
                            style={[styles.addSubInput, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                            placeholder="Subcategory Name"
                            placeholderTextColor={theme.onSurfaceVariant}
                            value={newSubName}
                            onChangeText={setNewSubName}
                            autoFocus
                          />
                          {filterType === 'expense' && (
                            <View style={[styles.addSubLimitInputWrap, { backgroundColor: theme.pillBg }]}>
                              <Text style={[styles.limitInputPrefix, { color: theme.onSurfaceVariant }]}>{curr}</Text>
                              <TextInput
                                style={[styles.addSubInput, { color: theme.onSurface }]}
                                placeholder="Optional limit (e.g. 200)"
                                placeholderTextColor={theme.outline}
                                keyboardType="numeric"
                                value={newSubLimitStr}
                                onChangeText={setNewSubLimitStr}
                              />
                            </View>
                          )}
                          <View style={styles.addSubBoxActions}>
                            <TouchableOpacity
                              style={[styles.addSubCancelBtn, { backgroundColor: theme.pillBg }]}
                              onPress={() => setActiveSubInputCatId(null)}
                            >
                              <Text style={[styles.addSubCancelBtnText, { color: theme.onSurface }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.addSubSaveBtn, { backgroundColor: cat.color }]}
                              onPress={() => handleAddSub(cat.id)}
                            >
                              <Text style={styles.addSubSaveBtnText}>Add</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Add New Category button */}
          {!isAddingNew && !editingCategory && (
            <TouchableOpacity
              style={[styles.addCategoryBtn, { backgroundColor: theme.primary }]}
              onPress={handleStartAdd}
            >
              <MaterialCommunityIcons name="plus" size={20} color={theme.onPrimary} />
              <Text style={[styles.addCategoryBtnText, { color: theme.onPrimary }]}>
                Add New {filterType === 'expense' ? 'Expense' : 'Income'} Category
              </Text>
            </TouchableOpacity>
          )}

          {/* INLINE EDIT LIMIT DIALOG */}
          <Modal
            visible={editLimitVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setEditLimitVisible(false)}
          >
            <View style={styles.dialogOverlay}>
              <View style={[styles.dialogBox, { backgroundColor: theme.surface }, M3Elevation.level3]}>
                <View style={styles.dialogHeader}>
                  <Text style={[styles.dialogTitle, { color: theme.onSurface }]}>Set Budget Limit</Text>
                  <TouchableOpacity onPress={() => setEditLimitVisible(false)}>
                    <MaterialCommunityIcons name="close" size={20} color={theme.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.dialogTargetName, { color: theme.primary }]}>{editLimitTargetName}</Text>

                {editLimitMaxAllowed !== null && editLimitMaxAllowed > 0 && (
                  <Text style={[styles.dialogHint, { color: theme.onSurfaceVariant }]}>
                    {editLimitScope === 'subcategory'
                      ? `Must not exceed parent category limit: ${formatCurrency(editLimitMaxAllowed, curr)}`
                      : `Overall cycle limit: ${formatCurrency(editLimitMaxAllowed, curr)}`}
                  </Text>
                )}

                <View style={[styles.dialogInputWrap, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}>
                  <Text style={[styles.inputPrefix, { color: theme.onSurfaceVariant }]}>{curr}</Text>
                  <TextInput
                    style={[styles.dialogInput, { color: theme.onSurface }]}
                    placeholder="0.00"
                    placeholderTextColor={theme.outline}
                    keyboardType="numeric"
                    value={editLimitAmountStr}
                    onChangeText={setEditLimitAmountStr}
                    autoFocus
                  />
                </View>

                <View style={styles.dialogActions}>
                  <TouchableOpacity
                    style={[styles.dialogClearBtn, { backgroundColor: theme.pillBg }]}
                    onPress={handleClearInlineLimit}
                  >
                    <Text style={[styles.dialogClearBtnText, { color: theme.error }]}>Remove Limit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dialogSaveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSaveInlineLimit}
                  >
                    <Text style={[styles.dialogSaveBtnText, { color: theme.onPrimary }]}>Save Limit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* EDIT SUBCATEGORY MODAL */}
          <Modal
            visible={editingSubModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setEditingSubModalVisible(false)}
          >
            <View style={styles.dialogOverlay}>
              <View style={[styles.dialogBox, { backgroundColor: theme.surface }, M3Elevation.level3]}>
                <View style={styles.dialogHeader}>
                  <Text style={[styles.dialogTitle, { color: theme.onSurface }]}>Edit Subcategory</Text>
                  <TouchableOpacity onPress={() => setEditingSubModalVisible(false)}>
                    <MaterialCommunityIcons name="close" size={20} color={theme.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                {editingSubParentCat && (
                  <Text style={[styles.dialogTargetName, { color: theme.primary }]}>
                    Category: {editingSubParentCat.name}
                  </Text>
                )}

                {/* Subcategory Name */}
                <Text style={[styles.dialogFieldLabel, { color: theme.onSurfaceVariant }]}>NAME</Text>
                <TextInput
                  style={[
                    styles.dialogNameInput,
                    { backgroundColor: theme.pillBg, color: theme.onSurface, borderColor: theme.divider },
                  ]}
                  placeholder="Subcategory Name"
                  placeholderTextColor={theme.outline}
                  value={editSubName}
                  onChangeText={setEditSubName}
                />

                {/* Monthly Spending Limit (for expense categories) */}
                {filterType === 'expense' && (
                  <>
                    <View style={styles.dialogLimitLabelRow}>
                      <Text style={[styles.dialogFieldLabel, { color: theme.onSurfaceVariant }]}>
                        MONTHLY LIMIT (OPTIONAL)
                      </Text>
                      {parentCatLimit > 0 && (
                        <Text style={[styles.dialogSubHint, { color: theme.primary }]}>
                          Parent limit: {formatCurrency(parentCatLimit, curr)}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.dialogInputWrap, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}>
                      <Text style={[styles.inputPrefix, { color: theme.onSurfaceVariant }]}>{curr}</Text>
                      <TextInput
                        style={[styles.dialogInput, { color: theme.onSurface }]}
                        placeholder="0.00"
                        placeholderTextColor={theme.outline}
                        keyboardType="numeric"
                        value={editSubLimitStr}
                        onChangeText={setEditSubLimitStr}
                      />
                    </View>
                  </>
                )}

                {/* Dialog Actions: Delete on left, Cancel & Save on right */}
                <View style={styles.dialogActions}>
                  {editingSubcategory && (
                    <TouchableOpacity
                      style={[styles.dialogDeleteBtn, { backgroundColor: theme.errorContainer }]}
                      onPress={() => handleDeleteSubcategory(editingSubcategory.id, editingSubcategory.name)}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.onErrorContainer} />
                      <Text style={[styles.dialogDeleteBtnText, { color: theme.onErrorContainer }]}>Delete</Text>
                    </TouchableOpacity>
                  )}

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity
                    style={[styles.dialogCancelBtn, { backgroundColor: theme.pillBg }]}
                    onPress={() => setEditingSubModalVisible(false)}
                  >
                    <Text style={[styles.dialogCancelBtnText, { color: theme.onSurface }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dialogSaveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSaveSubcategory}
                  >
                    <Text style={[styles.dialogSaveBtnText, { color: theme.onPrimary }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '92%',
    borderTopLeftRadius: M3Shape.extraLarge,
    borderTopRightRadius: M3Shape.extraLarge,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    borderRadius: M3Shape.full,
    padding: 4,
    marginBottom: 10,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: M3Shape.full,
  },
  filterText: {
    fontSize: 13,
  },
  overviewBanner: {
    borderRadius: M3Shape.large,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  overviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  overviewAmount: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  editOverallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  editOverallBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  overviewProgressBg: {
    height: 6,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  overviewProgressFill: {
    height: '100%',
    borderRadius: M3Shape.full,
  },
  overviewStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewStatText: {
    fontSize: 11,
  },
  editorBox: {
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 14,
    marginBottom: 14,
  },
  editorTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  nameInput: {
    height: 44,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  limitFormSection: {
    marginBottom: 10,
  },
  limitLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  unallocatedHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  limitInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
  },
  limitInputPrefix: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  limitInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  pickerRow: {
    marginBottom: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  editorActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  deleteCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  deleteCatBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  categoryCard: {
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 12,
    marginBottom: 10,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catIconWrap: {
    width: 38,
    height: 38,
    borderRadius: M3Shape.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catDetails: {
    flex: 1,
  },
  catNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    fontSize: 15,
    fontWeight: '800',
  },
  catStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  catSpentText: {
    fontSize: 11,
    fontWeight: '500',
  },
  setLimitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: M3Shape.full,
    gap: 3,
  },
  setLimitChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  catSubCount: {
    fontSize: 11,
    marginTop: 2,
  },
  catProgressBg: {
    height: 5,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
    marginTop: 6,
  },
  catProgressFill: {
    height: '100%',
    borderRadius: M3Shape.full,
  },
  catActions: {
    flexDirection: 'row',
    gap: 6,
  },
  smallIconBtn: {
    width: 30,
    height: 30,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
  },
  subToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addSubToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: M3Shape.full,
    gap: 3,
  },
  addSubToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subSection: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 8,
    gap: 6,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: M3Shape.medium,
    gap: 8,
  },
  subMainInfo: {
    flex: 1,
  },
  subTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  subLimitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subSpentText: {
    fontSize: 11,
    marginTop: 1,
  },
  subProgressBg: {
    height: 4,
    borderRadius: M3Shape.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  subProgressFill: {
    height: '100%',
    borderRadius: M3Shape.full,
  },
  subItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subIconBtn: {
    width: 26,
    height: 26,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubBox: {
    borderWidth: 1,
    borderRadius: M3Shape.medium,
    padding: 10,
    marginTop: 6,
    gap: 8,
  },
  addSubBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  addSubInput: {
    height: 38,
    borderRadius: M3Shape.small,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  addSubLimitInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: M3Shape.small,
    paddingHorizontal: 10,
  },
  addSubBoxActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  addSubCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
  },
  addSubCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addSubSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: M3Shape.full,
  },
  addSubSaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: M3Shape.full,
    marginTop: 10,
    gap: 8,
  },
  addCategoryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  dialogBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  dialogTargetName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  dialogHint: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  dialogInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  dialogInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogClearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  dialogClearBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dialogSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  dialogSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dialogFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  dialogNameInput: {
    height: 44,
    borderRadius: M3Shape.medium,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  dialogLimitLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dialogSubHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  dialogDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: M3Shape.full,
    gap: 4,
  },
  dialogDeleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dialogCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: M3Shape.full,
    marginRight: 8,
  },
  dialogCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
