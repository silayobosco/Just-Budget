import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  Switch,
  Pressable,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { getDB } from '../services/db';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';
import { Category, Subcategory, BudgetProgress, BudgetScope, TransactionType, Wallet } from '../types';
import { formatCurrency, formatTypingNumber, parseCleanNumber } from '../utils/format';

interface CategoryManagerModalProps {
  visible: boolean;
  onClose: () => void;
  mode?: 'manage' | 'pick';
  txType?: TransactionType;
  amount?: number;
  walletId?: string;
  wallets?: Wallet[];
  categories?: Category[];
  theme?: any;
  baseCurrency?: string;
  onSave?: (params: { categoryId?: string; subcategoryId?: string }) => void;
  onOpenMoreOptions?: (initialParams: { categoryId?: string; subcategoryId?: string }) => void;
  onManageCategories?: () => void;
  onAddSubcategory?: (categoryId: string, name: string) => Promise<string>;
  initialCategoryId?: string;
  initialSubcategoryId?: string;
  selectOnly?: boolean;
  confirmButtonText?: string;
  useNativeModal?: boolean;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  visible,
  onClose,
  mode = 'manage',
  txType,
  amount = 0,
  theme: propTheme,
  baseCurrency: propBaseCurrency,
  onSave,
  onOpenMoreOptions,
  initialCategoryId,
  initialSubcategoryId,
  selectOnly = false,
  confirmButtonText,
  useNativeModal = true,
}) => {
  const insets = useSafeAreaInsets();
  const {
    categories,
    transactions,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    restoreDefaultCategories,
    budgets,
    setBudgetLimit,
    deleteBudgetLimit,
    categoryBudgetProgressList,
    overallBudgetLimit,
    overallBudgetSpent,
    allocatedCategoriesBudget,
    unallocatedBudgetRemainder,
    incomeGoal,
    incomeInCycle,
    allocatedCategoriesIncome,
    unallocatedIncomeRemainder,
    settings,
  } = useBudget();

  const theme = propTheme || (settings.theme_mode === 'dark' ? darkTheme : lightTheme);
  const curr = propBaseCurrency || settings.base_currency;

  const [activeMode, setActiveMode] = useState<'manage' | 'pick'>(mode);
  const [filterType, setFilterType] = useState<'expense' | 'income'>(
    txType === 'income' ? 'income' : 'expense'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [manageFilter, setManageFilter] = useState<'all' | 'budgeted' | 'over' | 'untracked'>('all');
  const [sortBy, setSortBy] = useState<'custom' | 'most_used' | 'amount' | 'name'>(() => {
    try {
      const db = getDB();
      const row = db.getFirstSync<{ value: string }>(
        `SELECT value FROM settings WHERE key = 'category_sort_by'`
      );
      if (row?.value === 'most_used' || row?.value === 'amount' || row?.value === 'name' || row?.value === 'custom') {
        return row.value;
      }
    } catch {}
    return 'custom';
  });

  const handleSelectSort = (nextSort: 'custom' | 'most_used' | 'amount' | 'name') => {
    setSortBy(nextSort);
    setSortMenuOpen(false);
    try {
      const db = getDB();
      db.runSync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('category_sort_by', ?)`, [nextSort]);
    } catch {}
  };
  const [selectedCatId, setSelectedCatId] = useState<string | undefined>(initialCategoryId);
  const [selectedSubId, setSelectedSubId] = useState<string | undefined>(initialSubcategoryId);

  useEffect(() => {
    if (visible) {
      setActiveMode(mode);
      if (txType === 'expense' || txType === 'income') {
        setFilterType(txType);
      }
      setSelectedCatId(initialCategoryId);
      setSelectedSubId(initialSubcategoryId);
      setSearchQuery('');
      setSearchOpen(false);
      setSortMenuOpen(false);
      setManageFilter('all');
      setIsAddingNew(false);
      setEditingCategory(null);
      if (initialCategoryId) {
        setExpandedCatIds((prev) => ({ ...prev, [initialCategoryId]: true }));
      }
    }
  }, [visible, mode, txType, initialCategoryId, initialSubcategoryId]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // Form states for Category
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('tag-outline');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [newCatLimitStr, setNewCatLimitStr] = useState('');
  const [newCatExcludeAnalytics, setNewCatExcludeAnalytics] = useState(false);

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
    setExpandedCatIds((prev) => (prev[catId] ? {} : { [catId]: true }));
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
    'cart-outline', 'gas-station', 'lightning-bolt-outline', 'water-outline',
    'wifi', 'bus', 'taxi', 'medical-bag',
    'tshirt-crew-outline', 'baby-carriage', 'paw', 'hand-heart-outline',
    'church', 'music', 'movie-open-outline', 'tools',
    'store-outline', 'piggy-bank-outline', 'tag-outline', 'shape-outline',
  ];

  const handleStartAdd = () => {
    setEditingCategory(null);
    setNewCatName('');
    setNewCatIcon('tag-outline');
    setNewCatColor(colors[Math.floor(Math.random() * colors.length)]);
    setNewCatLimitStr('');
    setNewCatExcludeAnalytics(false);
    setIsAddingNew(true);
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setNewCatName(cat.name);
    setNewCatIcon(cat.icon);
    setNewCatColor(cat.color);
    setNewCatExcludeAnalytics(Boolean(cat.exclude_from_analytics));

    // Look up current limit
    const catProgress = categoryBudgetProgressList.find((c) => c.id === cat.id);
    setNewCatLimitStr(catProgress && catProgress.limit > 0 ? formatTypingNumber(catProgress.limit.toString()) : '');
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

    const limitVal = parseCleanNumber(newCatLimitStr);

    if (editingCategory) {
      await updateCategory({
        ...editingCategory,
        name: newCatName.trim(),
        icon: newCatIcon,
        color: newCatColor,
        exclude_from_analytics: newCatExcludeAnalytics,
      });

      await setBudgetLimit({
        scope: 'category',
        category_id: editingCategory.id,
        amount: limitVal,
        type: filterType,
      });

      setEditingCategory(null);
    } else {
      const createdId = await addCategory({
        name: newCatName.trim(),
        type: filterType,
        icon: newCatIcon,
        color: newCatColor,
        initial_limit: limitVal > 0 ? limitVal : undefined,
        exclude_from_analytics: newCatExcludeAnalytics,
      });

      setIsAddingNew(false);
    }

    setNewCatName('');
    setNewCatLimitStr('');
    setNewCatExcludeAnalytics(false);
  };

  const handleAddSub = async (catId: string) => {
    if (!newSubName.trim()) return;

    const subLimitVal = parseCleanNumber(newSubLimitStr);

    // Check if parent category has a limit/target and subcategory exceeds it
    if (subLimitVal > 0) {
      const catProgress = categoryBudgetProgressList.find((c) => c.id === catId);
      if (catProgress && catProgress.limit > 0 && subLimitVal > catProgress.limit) {
        Alert.alert(
          filterType === 'expense' ? 'Limit Exceeded' : 'Target Exceeded',
          `Subcategory ${filterType === 'expense' ? 'limit' : 'target'} cannot exceed parent category of ${formatCurrency(catProgress.limit, curr)}.`
        );
        return;
      }
    }

    await addSubcategory(catId, newSubName.trim(), subLimitVal > 0 ? subLimitVal : undefined);
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
    setEditSubLimitStr(subProgress && subProgress.limit > 0 ? formatTypingNumber(subProgress.limit.toString()) : '');

    setEditingSubModalVisible(true);
  };

  const handleSaveSubcategory = async () => {
    if (!editingSubcategory || !editSubName.trim()) return;

    // 1. Update subcategory name
    await updateSubcategory(editingSubcategory.id, editSubName.trim());

    // 2. If expense, update or clear budget limit
    if (filterType === 'expense' && editingSubParentCat) {
      const limitVal = parseCleanNumber(editSubLimitStr);
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
    setEditLimitAmountStr(catProgress && catProgress.limit > 0 ? formatTypingNumber(catProgress.limit.toString()) : '');
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
    setEditLimitAmountStr(subProgress && subProgress.limit > 0 ? formatTypingNumber(subProgress.limit.toString()) : '');
    setEditLimitMaxAllowed(catProgress && catProgress.limit > 0 ? catProgress.limit : null);
    setEditLimitVisible(true);
  };

  const openEditOverallLimit = () => {
    setEditLimitScope('overall');
    setEditLimitTargetId('overall');
    setEditLimitParentCatId('');
    setEditLimitTargetName(filterType === 'expense' ? 'Overall Monthly Spending Budget' : 'Overall Monthly Income Target');
    setEditLimitAmountStr(
      filterType === 'expense'
        ? (overallBudgetLimit > 0 ? formatTypingNumber(overallBudgetLimit.toString()) : '')
        : (incomeGoal > 0 ? formatTypingNumber(incomeGoal.toString()) : '')
    );
    setEditLimitMaxAllowed(null);
    setEditLimitVisible(true);
  };

  const handleSaveInlineLimit = async () => {
    const amount = parseCleanNumber(editLimitAmountStr);

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
        filterType === 'expense' ? 'Subcategory Limit Exceeded' : 'Subcategory Target Exceeded',
        `A subcategory ${filterType === 'expense' ? 'limit' : 'target'} cannot exceed parent of ${formatCurrency(editLimitMaxAllowed, curr)}.`
      );
      return;
    }

    if (editLimitScope === 'overall') {
      await setBudgetLimit({ scope: 'overall', amount, type: filterType });
    } else if (editLimitScope === 'category') {
      await setBudgetLimit({ scope: 'category', category_id: editLimitTargetId, amount, type: filterType });
    } else if (editLimitScope === 'subcategory') {
      await setBudgetLimit({
        scope: 'subcategory',
        category_id: editLimitParentCatId,
        subcategory_id: editLimitTargetId,
        amount,
        type: filterType,
      });
    }

    setEditLimitVisible(false);
  };

  const handleClearInlineLimit = async () => {
    if (editLimitScope === 'overall') {
      await setBudgetLimit({ scope: 'overall', amount: 0, type: filterType });
    } else if (editLimitScope === 'category') {
      await setBudgetLimit({ scope: 'category', category_id: editLimitTargetId, amount: 0, type: filterType });
    } else if (editLimitScope === 'subcategory') {
      await setBudgetLimit({
        scope: 'subcategory',
        category_id: editLimitParentCatId,
        subcategory_id: editLimitTargetId,
        amount: 0,
        type: filterType,
      });
    }

    setEditLimitVisible(false);
  };

  const handleRestoreDefaults = () => {
    Alert.alert(
      'Restore Default Categories',
      'This will restore all standard default expense categories (Food & Dining, Housing & Bills, Transportation, Shopping & Goods, Fun & Leisure, Health & Wellness) and income categories (Salary, Investment, Rewards, Gifts, Business). Your existing categories and transactions will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'default',
          onPress: async () => {
            await restoreDefaultCategories();
          },
        },
      ]
    );
  };

  const typeCategories = useMemo(
    () => categories.filter((c) => c.type === filterType),
    [categories, filterType]
  );

  const categoryUsageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.category_id) {
        counts[tx.category_id] = (counts[tx.category_id] || 0) + 1;
      }
    }
    return counts;
  }, [transactions]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = typeCategories.filter((c) => {
      if (q) {
        const nameMatch = c.name.toLowerCase().includes(q);
        const subMatch = c.subcategories?.some((s) => s.name.toLowerCase().includes(q));
        if (!nameMatch && !subMatch) return false;
      }
      if (activeMode === 'manage' && manageFilter !== 'all') {
        const prog = categoryBudgetProgressList.find((p) => p.id === c.id);
        const hasLim = Boolean(prog && prog.limit > 0);
        if (manageFilter === 'budgeted' && !hasLim) return false;
        if (manageFilter === 'over' && !(hasLim && (prog!.isOverBudget || prog!.isNearLimit))) return false;
        if (manageFilter === 'untracked' && !c.exclude_from_analytics) return false;
      }
      return true;
    });

    if (sortBy === 'most_used') {
      return [...list].sort((a, b) => {
        const diff = (categoryUsageCount[b.id] || 0) - (categoryUsageCount[a.id] || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    }
    if (sortBy === 'amount') {
      return [...list].sort((a, b) => {
        const spentA = categoryBudgetProgressList.find((p) => p.id === a.id)?.spent || 0;
        const spentB = categoryBudgetProgressList.find((p) => p.id === b.id)?.spent || 0;
        return spentB !== spentA ? spentB - spentA : a.name.localeCompare(b.name);
      });
    }
    if (sortBy === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [typeCategories, searchQuery, activeMode, manageFilter, categoryBudgetProgressList, sortBy, categoryUsageCount]);

  const [draggingCatId, setDraggingCatId] = useState<string | null>(null);
  const [dragTargetIdx, setDragTargetIdx] = useState<number | null>(null);
  const dragDy = useRef(new Animated.Value(0)).current;
  const rowHeightsRef = useRef<Record<string, number>>({});
  const dragTargetRef = useRef<number | null>(null);
  const dragStartIdxRef = useRef<number>(0);

  const canReorder =
    activeMode === 'manage' && !searchQuery.trim() && manageFilter === 'all' && sortBy === 'custom';

  const canReorderRef = useRef(canReorder);
  canReorderRef.current = canReorder;
  const typeCategoriesRef = useRef(typeCategories);
  typeCategoriesRef.current = typeCategories;
  const filteredCategoriesRef = useRef(filteredCategories);
  filteredCategoriesRef.current = filteredCategories;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const filterTypeRef = useRef(filterType);
  filterTypeRef.current = filterType;
  const reorderCategoriesRef = useRef(reorderCategories);
  reorderCategoriesRef.current = reorderCategories;

  const panRespondersRef = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});

  const getDragResponder = (catId: string) => {
    if (!panRespondersRef.current[catId]) {
      panRespondersRef.current[catId] = PanResponder.create({
        onStartShouldSetPanResponder: () => canReorderRef.current,
        onMoveShouldSetPanResponder: () => canReorderRef.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const idx = filteredCategoriesRef.current.findIndex((c) => c.id === catId);
          if (idx < 0) return;
          setExpandedCatIds({});
          dragDy.setValue(0);
          dragStartIdxRef.current = idx;
          dragTargetRef.current = idx;
          setDraggingCatId(catId);
          setDragTargetIdx(idx);
        },
        onPanResponderMove: (_, gestureState) => {
          dragDy.setValue(gestureState.dy);
          const avgH = rowHeightsRef.current[catId] || 76;
          const startIdx = dragStartIdxRef.current;
          const maxIdx = Math.max(0, filteredCategoriesRef.current.length - 1);
          const steps = Math.round(gestureState.dy / avgH);
          const nextIdx = Math.max(0, Math.min(maxIdx, startIdx + steps));
          if (nextIdx !== dragTargetRef.current) {
            dragTargetRef.current = nextIdx;
            setDragTargetIdx(nextIdx);
          }
        },
        onPanResponderRelease: () => {
          const startIdx = dragStartIdxRef.current;
          const finalIdx = dragTargetRef.current ?? startIdx;
          setDraggingCatId(null);
          setDragTargetIdx(null);
          dragTargetRef.current = null;
          dragDy.setValue(0);
          if (finalIdx !== startIdx) {
            const tc = typeCategoriesRef.current;
            if (startIdx >= 0 && finalIdx >= 0 && startIdx < tc.length && finalIdx < tc.length) {
              const nextTypeIds = tc.map((c) => c.id);
              const [moved] = nextTypeIds.splice(startIdx, 1);
              nextTypeIds.splice(finalIdx, 0, moved);
              const otherIds = categoriesRef.current
                .filter((c) => c.type !== filterTypeRef.current)
                .map((c) => c.id);
              reorderCategoriesRef.current([...nextTypeIds, ...otherIds]);
            }
          }
        },
        onPanResponderTerminate: () => {
          setDraggingCatId(null);
          setDragTargetIdx(null);
          dragTargetRef.current = null;
          dragDy.setValue(0);
        },
      });
    }
    return panRespondersRef.current[catId];
  };

  if (!visible) return null;

  const sheetBody = (
    <View style={styles.overlay}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 12,
          },
        ]}
      >
        {/* Drag Handle */}
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: theme.outlineVariant }} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.onSurface }]}>
              {activeMode === 'pick' ? 'Select Category' : 'Category & Budget Manager'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.onSurfaceVariant }]}>
              {activeMode === 'pick'
                ? `${filterType === 'income' ? 'Income' : 'Expense'}${amount > 0 ? ` • ${formatCurrency(amount, curr)}` : ' • Tap to pick'}`
                : 'Envelopes, order, categories & limits'}
            </Text>
          </View>

          {Boolean(onSave || mode === 'pick') && (
            <TouchableOpacity
              onPress={() => setActiveMode(activeMode === 'pick' ? 'manage' : 'pick')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: M3Shape.full,
                backgroundColor: activeMode === 'manage' ? theme.primary : theme.primaryContainer,
                marginRight: 6,
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={activeMode === 'pick' ? 'pencil-outline' : 'check'}
                size={14}
                color={activeMode === 'manage' ? theme.onPrimary : theme.onPrimaryContainer}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: activeMode === 'manage' ? theme.onPrimary : theme.onPrimaryContainer,
                }}
              >
                {activeMode === 'pick' ? 'Edit' : 'Pick'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              setSortMenuOpen((prev) => !prev);
            }}
            style={[
              styles.restoreBtn,
              {
                backgroundColor: sortMenuOpen || sortBy !== 'custom' ? theme.primaryContainer : theme.pillBg,
                marginRight: 6,
              },
            ]}
            accessibilityLabel="Sort Categories"
          >
            <MaterialCommunityIcons
              name="sort-variant"
              size={18}
              color={sortMenuOpen || sortBy !== 'custom' ? theme.primary : theme.onSurface}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (searchOpen) {
                setSearchQuery('');
                setSearchOpen(false);
              } else {
                setSearchOpen(true);
              }
            }}
            style={[
              styles.restoreBtn,
              {
                backgroundColor: searchOpen || searchQuery ? theme.primaryContainer : theme.pillBg,
                marginRight: 6,
              },
            ]}
            accessibilityLabel="Search Categories"
          >
            <MaterialCommunityIcons
              name="magnify"
              size={18}
              color={searchOpen || searchQuery ? theme.primary : theme.onSurface}
            />
          </TouchableOpacity>

          {activeMode === 'manage' && (
            <TouchableOpacity
              onPress={handleRestoreDefaults}
              style={[styles.restoreBtn, { backgroundColor: theme.pillBg, marginRight: 6 }]}
              accessibilityLabel="Restore Default Categories"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="backup-restore" size={18} color={theme.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}>
            <MaterialCommunityIcons name="close" size={20} color={theme.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Collapsible Search Bar */}
        {searchOpen && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              height: 38,
              borderRadius: M3Shape.full,
              backgroundColor: theme.pillBg,
              marginBottom: 8,
            }}
          >
            <MaterialCommunityIcons name="magnify" size={18} color={theme.onSurfaceVariant} />
            <TextInput
              autoFocus
              style={{ flex: 1, fontSize: 13, color: theme.onSurface, paddingVertical: 0 }}
              placeholder="Search categories or subcategories..."
              placeholderTextColor={theme.onSurfaceVariant}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Collapsible Sort Menu */}
        {sortMenuOpen && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              padding: 8,
              borderRadius: M3Shape.medium,
              backgroundColor: theme.cardBg,
              borderWidth: 1,
              borderColor: theme.divider,
              marginBottom: 8,
            }}
          >
            {(
              [
                { key: 'custom', label: 'Custom Order' },
                { key: 'most_used', label: 'Most Used' },
                { key: 'amount', label: 'Top Amount' },
                { key: 'name', label: 'Name (A–Z)' },
              ] as const
            ).map((s) => {
              const active = sortBy === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => handleSelectSort(s.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: M3Shape.full,
                    backgroundColor: active ? theme.primaryContainer : theme.pillBg,
                    borderWidth: 1,
                    borderColor: active ? theme.primary : 'transparent',
                  }}
                >
                  {active && (
                    <MaterialCommunityIcons name="check" size={12} color={theme.onPrimaryContainer} />
                  )}
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: active ? '800' : '600',
                      color: active ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                    }}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Filter Expense / Income Tabs (shown in Manage mode, or Pick mode when txType wasn't fixed) */}
        {(activeMode === 'manage' || !txType) && (
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
                {activeMode === 'pick' ? 'Expenses' : 'Expense Budgets'}
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
                {activeMode === 'pick' ? 'Income' : 'Income Sources'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manage Mode Filter Chips */}
        {activeMode === 'manage' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 34, marginBottom: 8 }}
            contentContainerStyle={{ gap: 6, alignItems: 'center' }}
          >
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'budgeted', label: 'Budgeted' },
                { key: 'over', label: 'Over / Near' },
                { key: 'untracked', label: 'Untracked' },
              ] as const
            ).map((chip) => {
              const active = manageFilter === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 5,
                    borderRadius: M3Shape.full,
                    backgroundColor: active ? theme.primaryContainer : theme.pillBg,
                    borderWidth: 1,
                    borderColor: active ? theme.primary : 'transparent',
                  }}
                  onPress={() => setManageFilter(chip.key)}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: active ? '800' : '600',
                      color: active ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                    }}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Context Banner: Overall Budget & Envelope Remainder (Manage mode only) */}
        {activeMode === 'manage' && (
          <View
            style={[
              styles.overviewBanner,
              filterType === 'expense' && allocatedCategoriesBudget > overallBudgetLimit && overallBudgetLimit > 0
                ? { backgroundColor: theme.errorContainer, borderColor: theme.error }
                : { backgroundColor: theme.cardBg, borderColor: theme.divider },
              M3Elevation.level1,
            ]}
          >
            <View style={styles.overviewTopRow}>
              <View>
                <Text style={[styles.overviewLabel, { color: theme.onSurfaceVariant }]}>
                  {filterType === 'expense' ? 'OVERALL SPENDING BUDGET' : 'OVERALL INCOME TARGET'}
                </Text>
                <Text style={[styles.overviewAmount, { color: filterType === 'expense' ? theme.primary : theme.success }]}>
                  {filterType === 'expense'
                    ? (overallBudgetLimit > 0 ? formatCurrency(overallBudgetLimit, curr) : 'No limit set')
                    : (incomeGoal > 0 ? formatCurrency(incomeGoal, curr) : 'No target set')}
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

            {filterType === 'expense' ? (
              overallBudgetLimit > 0 && (
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
              )
            ) : (
              incomeGoal > 0 && (
                <View style={[styles.overviewProgressBg, { backgroundColor: theme.surfaceVariant }]}>
                  <View
                    style={[
                      styles.overviewProgressFill,
                      {
                        width: `${Math.min(100, Math.round((incomeInCycle / incomeGoal) * 100))}%`,
                        backgroundColor: incomeInCycle >= incomeGoal ? theme.success : theme.primary,
                      },
                    ]}
                  />
                </View>
              )
            )}

            <View style={styles.overviewStatsRow}>
              <Text style={[styles.overviewStatText, { color: theme.onSurfaceVariant }]}>
                {filterType === 'expense' ? 'Envelopes: ' : 'Allocated: '}
                <Text style={{ fontWeight: '700' }}>
                  {formatCurrency(filterType === 'expense' ? allocatedCategoriesBudget : allocatedCategoriesIncome, curr)}
                </Text>
              </Text>
              {filterType === 'expense' ? (
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
              ) : (
                <Text style={[styles.overviewStatText, { color: theme.onSurfaceVariant }]}>
                  Earned: <Text style={{ fontWeight: '700', color: theme.success }}>{formatCurrency(incomeInCycle, curr)}</Text>
                  {incomeGoal > 0 ? ` (${Math.round((incomeInCycle / incomeGoal) * 100)}%)` : ''}
                </Text>
              )}
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

              {/* Monthly Budget Limit / Target Input */}
              <View style={styles.limitFormSection}>
                <View style={styles.limitLabelRow}>
                  <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
                    {filterType === 'expense' ? 'Monthly Spending Limit' : 'Monthly Income Target'}
                  </Text>
                  {filterType === 'expense' ? (
                    unallocatedBudgetRemainder > 0 && (
                      <Text style={[styles.unallocatedHint, { color: theme.primary }]}>
                        ({formatCurrency(unallocatedBudgetRemainder, curr)} unallocated)
                      </Text>
                    )
                  ) : (
                    unallocatedIncomeRemainder > 0 && (
                      <Text style={[styles.unallocatedHint, { color: theme.primary }]}>
                        ({formatCurrency(unallocatedIncomeRemainder, curr)} unallocated)
                      </Text>
                    )
                  )}
                </View>
                <View style={[styles.limitInputWrap, { backgroundColor: theme.pillBg }]}>
                  <Text style={[styles.limitInputPrefix, { color: theme.onSurfaceVariant }]}>{curr}</Text>
                  <TextInput
                    style={[styles.limitInput, { color: theme.onSurface }]}
                    placeholder={
                      newCatExcludeAnalytics
                        ? '0.00 (optional fundraising goal)'
                        : filterType === 'expense'
                          ? '0.00 (optional limit)'
                          : '0.00 (optional target)'
                    }
                    placeholderTextColor={theme.outline}
                    keyboardType="numeric"
                    value={newCatLimitStr}
                    onChangeText={(t) => setNewCatLimitStr(formatTypingNumber(t))}
                  />
                </View>
              </View>

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

              {/* Exclude from Budget & Analytics Toggle */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  marginBottom: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: M3Shape.small,
                  backgroundColor: theme.pillBg,
                }}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.onSurface }}>
                    Exclude from Budget & Analytics
                  </Text>
                  <Text style={{ fontSize: 11.5, color: theme.onSurfaceVariant, marginTop: 2 }}>
                    For fundraising, pass-through funds, or money held for others
                  </Text>
                </View>
                <Switch
                  value={newCatExcludeAnalytics}
                  onValueChange={setNewCatExcludeAnalytics}
                  trackColor={{ false: theme.outlineVariant, true: theme.primaryContainer }}
                  thumbColor={newCatExcludeAnalytics ? theme.primary : '#f4f3f4'}
                />
              </View>

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
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false} scrollEnabled={!draggingCatId}>
            {filteredCategories.length === 0 ? (
              <View style={[styles.emptyCategoryBox, { backgroundColor: theme.pillBg }]}>
                <MaterialCommunityIcons name="folder-alert-outline" size={40} color={theme.outlineVariant} />
                <Text style={[styles.emptyCategoryText, { color: theme.onSurfaceVariant }]}>
                  No {filterType} categories available
                </Text>
                <TouchableOpacity
                  style={[styles.emptyRestoreBtn, { backgroundColor: theme.primaryContainer }]}
                  onPress={handleRestoreDefaults}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="backup-restore" size={16} color={theme.onPrimaryContainer} />
                  <Text style={[styles.emptyRestoreText, { color: theme.onPrimaryContainer }]}>
                    Restore Default Categories
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredCategories.map((cat, idx) => {
              const catProgress = categoryBudgetProgressList.find((c) => c.id === cat.id);
              const hasLimit = catProgress && catProgress.limit > 0;
              const isExpanded = Boolean(expandedCatIds[cat.id]);
              const isAddingSubHere = activeSubInputCatId === cat.id;
              const isCatSelected = activeMode === 'pick' && selectedCatId === cat.id;

              let statusColor = theme.onSurfaceVariant;
              let statusText = filterType === 'expense' ? 'No limit' : 'No target';
              if (hasLimit) {
                if (filterType === 'expense') {
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
                } else {
                  if (catProgress.spent >= catProgress.limit) {
                    statusColor = theme.success;
                    statusText = 'Target reached! 🎉';
                  } else {
                    statusColor = theme.primary;
                    statusText = `${formatCurrency(catProgress.remaining, curr)} to go (${Math.round(catProgress.percent)}%)`;
                  }
                }
              }

              const isDragging = draggingCatId === cat.id;
              const isDropTarget = Boolean(draggingCatId) && !isDragging && dragTargetIdx === idx;
              const dragResponder = canReorder ? getDragResponder(cat.id) : null;
              const subs = cat.subcategories || [];

              if (activeMode === 'pick') {
                return (
                  <View key={cat.id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedCatId(cat.id);
                          setSelectedSubId(undefined);
                          if (subs.length > 0) {
                            setExpandedCatIds((prev) => (prev[cat.id] ? {} : { [cat.id]: true }));
                          } else {
                            setExpandedCatIds({});
                            if (selectOnly && onSave) {
                              onSave({ categoryId: cat.id, subcategoryId: undefined });
                            }
                          }
                        }}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: M3Shape.medium,
                          borderWidth: 1,
                          backgroundColor: isCatSelected ? theme.primaryContainer : theme.pillBg,
                          borderColor: isCatSelected ? theme.primary : 'transparent',
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            backgroundColor: cat.color,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MaterialCommunityIcons name={cat.icon as any} size={16} color="#FFFFFF" />
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 14,
                            color: isCatSelected ? theme.onPrimaryContainer : theme.onSurface,
                            fontWeight: isCatSelected ? '800' : '600',
                          }}
                          numberOfLines={1}
                        >
                          {cat.name}
                        </Text>
                        {subs.length > 0 && (
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.onSurfaceVariant }}>
                            {subs.length}
                          </Text>
                        )}
                      </TouchableOpacity>

                      {subs.length > 0 && (
                        <TouchableOpacity
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: M3Shape.medium,
                            borderWidth: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isExpanded ? theme.primary : theme.surface,
                            borderColor: isExpanded ? theme.primary : theme.divider,
                          }}
                          onPress={() => toggleExpand(cat.id)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel={`Expand ${cat.name} subcategories`}
                        >
                          <MaterialCommunityIcons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={isExpanded ? theme.onPrimary : theme.onSurfaceVariant}
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    {isExpanded && subs.length > 0 && (
                      <View
                        style={{
                          marginTop: 6,
                          marginLeft: 18,
                          paddingLeft: 12,
                          borderLeftWidth: 2,
                          borderLeftColor: theme.divider,
                          gap: 6,
                        }}
                      >
                        {subs.map((sub) => {
                          const isSubSel = selectedCatId === cat.id && selectedSubId === sub.id;
                          const subProgress = catProgress?.subBudgets?.find((s) => s.id === sub.id);
                          const subHasLimit = Boolean(subProgress && subProgress.limit > 0);
                          return (
                            <TouchableOpacity
                              key={sub.id}
                              activeOpacity={0.7}
                              onPress={() => {
                                setSelectedCatId(cat.id);
                                const nextSubId = isSubSel ? undefined : sub.id;
                                setSelectedSubId(nextSubId);
                                if (selectOnly && onSave) {
                                  onSave({ categoryId: cat.id, subcategoryId: nextSubId });
                                }
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: M3Shape.small,
                                borderWidth: 1,
                                backgroundColor: isSubSel ? theme.primaryContainer : theme.surface,
                                borderColor: isSubSel ? theme.primary : theme.divider,
                              }}
                            >
                              <MaterialCommunityIcons
                                name="subdirectory-arrow-right"
                                size={15}
                                color={isSubSel ? theme.primary : theme.onSurfaceVariant}
                              />
                              <View style={{ flex: 1, gap: 2 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                  <Text
                                    style={{
                                      flex: 1,
                                      fontSize: 13,
                                      color: isSubSel ? theme.onPrimaryContainer : theme.onSurface,
                                      fontWeight: isSubSel ? '700' : '500',
                                    }}
                                    numberOfLines={1}
                                  >
                                    {sub.name}
                                  </Text>
                                  {subHasLimit && subProgress && (
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        fontWeight: '700',
                                        color:
                                          filterType === 'expense'
                                            ? (subProgress.isOverBudget ? theme.error : theme.primary)
                                            : (subProgress.spent >= subProgress.limit ? theme.success : theme.primary),
                                      }}
                                    >
                                      {filterType === 'expense' ? 'Limit: ' : 'Target: '}
                                      {formatCurrency(subProgress.limit, curr)}
                                    </Text>
                                  )}
                                </View>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: isSubSel ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                                    opacity: isSubSel ? 0.9 : 1,
                                  }}
                                >
                                  {filterType === 'expense' ? 'Spent: ' : 'Earned: '}
                                  {formatCurrency(subProgress?.spent || 0, curr)}
                                  {subHasLimit && subProgress
                                    ? ` (${Math.round(subProgress.percent)}%)`
                                    : (filterType === 'expense' ? ' • No limit' : ' • No target')}
                                </Text>
                                {subHasLimit && subProgress && (
                                  <View style={[styles.subProgressBg, { backgroundColor: theme.surfaceVariant, marginTop: 2 }]}>
                                    <View
                                      style={[
                                        styles.subProgressFill,
                                        {
                                          width: `${Math.min(100, Math.round(subProgress.percent))}%`,
                                          backgroundColor:
                                            filterType === 'expense'
                                              ? (subProgress.isOverBudget
                                                ? theme.error
                                                : subProgress.isNearLimit
                                                ? '#D97706'
                                                : theme.primary)
                                              : (subProgress.spent >= subProgress.limit
                                                ? theme.success
                                                : theme.primary),
                                        },
                                      ]}
                                    />
                                  </View>
                                )}
                              </View>
                              {isSubSel && (
                                <MaterialCommunityIcons name="check" size={15} color={theme.primary} />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <Animated.View
                  key={cat.id}
                  onLayout={(e) => {
                    if (!draggingCatId) {
                      rowHeightsRef.current[cat.id] = e.nativeEvent.layout.height + 10;
                    }
                  }}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: isCatSelected ? theme.primaryContainer : theme.cardBg,
                      borderColor: isDragging || isDropTarget || isCatSelected ? theme.primary : theme.divider,
                      borderWidth: isDragging || isDropTarget ? 2 : 1,
                    },
                    isDragging && {
                      zIndex: 50,
                      elevation: 8,
                      transform: [{ translateY: dragDy }, { scale: 1.02 }],
                    },
                  ]}
                >
                  {/* Category Header */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleExpand(cat.id)}
                    style={styles.catHeader}
                  >
                    <View style={[styles.catIconWrap, { backgroundColor: cat.color }]}>
                      <MaterialCommunityIcons name={cat.icon as any} size={20} color="#FFFFFF" />
                    </View>

                    <View style={styles.catDetails}>
                      <View style={styles.catNameRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <Text style={[styles.catName, { color: theme.onSurface }]}>{cat.name}</Text>
                          {cat.exclude_from_analytics && (
                            <View style={{ backgroundColor: theme.pillBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceVariant }}>Excluded</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.catStatusText, { color: statusColor }]}>{statusText}</Text>
                      </View>

                      <View style={styles.budgetRow}>
                        <Text style={[styles.catSpentText, { color: theme.onSurfaceVariant }]}>
                          {filterType === 'expense' ? 'Spent: ' : 'Earned: '}
                          {formatCurrency(catProgress?.spent || 0, curr)}
                          {hasLimit ? ` / ${formatCurrency(catProgress.limit, curr)}` : ''}
                        </Text>
                      </View>

                      {/* Category Budget / Target Progress Bar */}
                      {hasLimit && (
                        <View style={[styles.catProgressBg, { backgroundColor: theme.surfaceVariant }]}>
                          <View
                            style={[
                              styles.catProgressFill,
                              {
                                width: `${Math.min(100, Math.round(catProgress.percent))}%`,
                                backgroundColor:
                                  filterType === 'expense'
                                    ? (catProgress.isOverBudget
                                      ? theme.error
                                      : catProgress.isNearLimit
                                      ? '#D97706'
                                      : cat.color)
                                    : (catProgress.spent >= catProgress.limit
                                      ? theme.success
                                      : cat.color),
                              },
                            ]}
                          />
                        </View>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={[styles.catActions, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                        <TouchableOpacity
                          onPress={() => handleStartEdit(cat)}
                          style={[styles.smallIconBtn, { backgroundColor: theme.pillBg }]}
                          accessibilityLabel="Edit Category"
                        >
                          <MaterialCommunityIcons name="pencil" size={16} color={theme.onSurface} />
                        </TouchableOpacity>
                        {canReorder && dragResponder && (
                          <View
                            {...dragResponder.panHandlers}
                            style={[styles.smallIconBtn, { backgroundColor: theme.pillBg }]}
                            accessibilityLabel="Drag to reorder category"
                          >
                            <MaterialCommunityIcons name="drag" size={18} color={theme.onSurfaceVariant} />
                          </View>
                        )}
                      </View>
                  </TouchableOpacity>

                  {/* Subcategories Toggle (only shown while expanded to keep collapsed cards compact) */}
                  {isExpanded && (
                    <View style={styles.subToggleRow}>
                      <TouchableOpacity
                        style={styles.subToggleBtn}
                        onPress={() => toggleExpand(cat.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.subToggleText, { color: theme.primary }]}>
                          Hide Subcategories
                        </Text>
                        <MaterialCommunityIcons
                          name="chevron-up"
                          size={18}
                          color={theme.primary}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.addSubToggleBtn, { backgroundColor: theme.pillBg }]}
                        onPress={() => {
                          setActiveSubInputCatId(isAddingSubHere ? null : cat.id);
                        }}
                      >
                        <MaterialCommunityIcons name="plus" size={14} color={theme.primary} />
                        <Text style={[styles.addSubToggleBtnText, { color: theme.primary }]}>Add Sub</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Expanded Subcategories */}
                  {isExpanded && (
                    <View style={[styles.subSection, { borderTopColor: theme.divider }]}>
                      {cat.subcategories?.map((sub) => {
                        const subProgress = catProgress?.subBudgets?.find((s) => s.id === sub.id);
                        const subHasLimit = subProgress && subProgress.limit > 0;

                        return (
                          <View
                            key={sub.id}
                            style={[styles.subItemRow, { backgroundColor: theme.pillBg }]}
                          >
                            <View style={styles.subMainInfo}>
                              <View style={styles.subTitleRow}>
                                <Text style={[styles.subItemName, { color: theme.onSurface }]}>{sub.name}</Text>
                                {subHasLimit && (
                                  <Text
                                    style={[
                                      styles.subLimitBadgeText,
                                      {
                                        color:
                                          filterType === 'expense'
                                            ? (subProgress.isOverBudget ? theme.error : theme.primary)
                                            : (subProgress.spent >= subProgress.limit ? theme.success : theme.primary),
                                      },
                                    ]}
                                  >
                                    {filterType === 'expense' ? 'Limit: ' : 'Target: '}
                                    {formatCurrency(subProgress.limit, curr)}
                                  </Text>
                                )}
                              </View>

                              <Text style={[styles.subSpentText, { color: theme.onSurfaceVariant }]}>
                                {filterType === 'expense' ? 'Spent: ' : 'Earned: '}
                                {formatCurrency(subProgress?.spent || 0, curr)}
                                {subHasLimit
                                  ? ` (${Math.round(subProgress.percent)}%)`
                                  : (filterType === 'expense' ? ' • No limit' : ' • No target')}
                              </Text>

                              {subHasLimit && (
                                <View style={[styles.subProgressBg, { backgroundColor: theme.surfaceVariant }]}>
                                  <View
                                    style={[
                                      styles.subProgressFill,
                                      {
                                        width: `${Math.min(100, Math.round(subProgress.percent))}%`,
                                        backgroundColor:
                                          filterType === 'expense'
                                            ? (subProgress.isOverBudget
                                              ? theme.error
                                              : subProgress.isNearLimit
                                              ? '#D97706'
                                              : theme.primary)
                                            : (subProgress.spent >= subProgress.limit
                                              ? theme.success
                                              : theme.primary),
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
                          <View style={[styles.addSubLimitInputWrap, { backgroundColor: theme.pillBg }]}>
                            <Text style={[styles.limitInputPrefix, { color: theme.onSurfaceVariant }]}>{curr}</Text>
                            <TextInput
                              style={[styles.addSubInput, { color: theme.onSurface }]}
                              placeholder={filterType === 'expense' ? 'Optional limit (e.g. 200)' : 'Optional target (e.g. 500)'}
                              placeholderTextColor={theme.outline}
                              keyboardType="numeric"
                              value={newSubLimitStr}
                              onChangeText={(t) => setNewSubLimitStr(formatTypingNumber(t))}
                            />
                          </View>
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
                </Animated.View>
              );
            })
          )}
          </ScrollView>

          {/* Bottom Action Bar */}
          {activeMode === 'pick' && onSave ? (
            <View style={styles.bottomBarRow}>
              {onOpenMoreOptions && !selectOnly && (
                <TouchableOpacity
                  style={[styles.restoreFooterBtn, { borderColor: theme.outlineVariant, backgroundColor: theme.pillBg }]}
                  onPress={() => onOpenMoreOptions({ categoryId: selectedCatId, subcategoryId: selectedSubId })}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="tune-variant" size={18} color={theme.primary} />
                  <Text style={[styles.restoreFooterBtnText, { color: theme.primary }]}>More Options</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.addCategoryBtn,
                  {
                    backgroundColor: selectedCatId ? theme.primary : theme.pillBg,
                    flex: 1,
                    opacity: selectedCatId ? 1 : 0.6,
                  },
                ]}
                disabled={!selectedCatId}
                onPress={() => onSave({ categoryId: selectedCatId, subcategoryId: selectedSubId })}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={18}
                  color={selectedCatId ? theme.onPrimary : theme.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.addCategoryBtnText,
                    { color: selectedCatId ? theme.onPrimary : theme.onSurfaceVariant },
                  ]}
                >
                  {confirmButtonText || (selectOnly ? 'Confirm' : 'Save')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            !isAddingNew && !editingCategory && (
              <View style={styles.bottomBarRow}>
                <TouchableOpacity
                  style={[styles.addCategoryBtn, { backgroundColor: theme.primary, flex: 1 }]}
                  onPress={handleStartAdd}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={theme.onPrimary} />
                  <Text style={[styles.addCategoryBtnText, { color: theme.onPrimary }]}>
                    Add Category
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.restoreFooterBtn, { borderColor: theme.outlineVariant, backgroundColor: theme.pillBg }]}
                  onPress={handleRestoreDefaults}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="backup-restore" size={18} color={theme.primary} />
                  <Text style={[styles.restoreFooterBtnText, { color: theme.primary }]}>
                    Restore Defaults
                  </Text>
                </TouchableOpacity>
              </View>
            )
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
                    onChangeText={(t) => setEditLimitAmountStr(formatTypingNumber(t))}
                    autoFocus
                  />
                </View>

                <View style={styles.dialogActions}>
                  <TouchableOpacity
                    style={[styles.dialogClearBtn, { backgroundColor: theme.pillBg }]}
                    onPress={handleClearInlineLimit}
                  >
                    <Text style={[styles.dialogClearBtnText, { color: theme.error }]}>
                      {filterType === 'expense' ? 'Remove Limit' : 'Remove Target'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dialogSaveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSaveInlineLimit}
                  >
                    <Text style={[styles.dialogSaveBtnText, { color: theme.onPrimary }]}>
                      {filterType === 'expense' ? 'Save Limit' : 'Save Target'}
                    </Text>
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

                {/* Monthly Spending Limit / Target */}
                <View style={styles.dialogLimitLabelRow}>
                  <Text style={[styles.dialogFieldLabel, { color: theme.onSurfaceVariant }]}>
                    {filterType === 'expense' ? 'MONTHLY LIMIT (OPTIONAL)' : 'MONTHLY TARGET (OPTIONAL)'}
                  </Text>
                  {parentCatLimit > 0 && (
                    <Text style={[styles.dialogSubHint, { color: theme.primary }]}>
                      {filterType === 'expense' ? 'Parent limit: ' : 'Parent target: '}
                      {formatCurrency(parentCatLimit, curr)}
                    </Text>
                  )}
                </View>
                <View style={[styles.dialogInputWrap, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}>
                  <Text style={[styles.inputPrefix, { color: theme.onSurfaceVariant }]}>{curr}</Text>
                  <TextInput
                    style={[styles.dialogInput, { color: theme.onSurface }]}
                    placeholder={filterType === 'expense' ? '0.00 (limit)' : '0.00 (target)'}
                    placeholderTextColor={theme.outline}
                    keyboardType="numeric"
                    value={editSubLimitStr}
                    onChangeText={(t) => setEditSubLimitStr(formatTypingNumber(t))}
                  />
                </View>

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
  );

  if (!useNativeModal) {
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}>
        {sheetBody}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {sheetBody}
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
  restoreBtn: {
    width: 36,
    height: 36,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
  emptyCategoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: M3Shape.large,
    marginVertical: 16,
    gap: 10,
  },
  emptyCategoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
    marginTop: 4,
  },
  emptyRestoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  restoreFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: M3Shape.full,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 6,
  },
  restoreFooterBtnText: {
    fontSize: 13,
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
