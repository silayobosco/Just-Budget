import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Category, Subcategory, Wallet, TransactionType } from '../types';
import { formatCurrency } from '../utils/format';
import { M3Elevation, M3Shape } from '../theme';

interface CategoryPickerSheetProps {
  visible: boolean;
  txType: TransactionType;
  amount: number;
  walletId: string;
  wallets: Wallet[];
  categories: Category[];
  theme: any;
  baseCurrency: string;
  onClose: () => void;
  onSave: (params: { categoryId?: string; subcategoryId?: string }) => void;
  onOpenMoreOptions: (initialParams: { categoryId?: string; subcategoryId?: string }) => void;
  onManageCategories?: () => void;
  onAddSubcategory?: (categoryId: string, name: string) => Promise<string>;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const CategoryPickerSheet: React.FC<CategoryPickerSheetProps> = ({
  visible,
  txType,
  amount,
  walletId,
  wallets,
  categories,
  theme,
  baseCurrency,
  onClose,
  onSave,
  onOpenMoreOptions,
  onManageCategories,
  onAddSubcategory,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [quickSubModalVisible, setQuickSubModalVisible] = useState(false);
  const [newSubName, setNewSubName] = useState('');

  const activeCategories = categories.filter((c) => c.type === txType);
  const selectedWallet = wallets.find((w) => w.id === walletId) || wallets[0];
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  useEffect(() => {
    if (visible) {
      // Default to first category if available or reset
      if (activeCategories.length > 0) {
        setSelectedCategoryId(activeCategories[0].id);
        if (activeCategories[0].subcategories && activeCategories[0].subcategories.length > 0) {
          setSelectedSubcategoryId(activeCategories[0].subcategories[0].id);
        } else {
          setSelectedSubcategoryId('');
        }
      } else {
        setSelectedCategoryId('');
        setSelectedSubcategoryId('');
      }
    }
  }, [visible, txType]);

  const handleSelectCategory = (cat: Category) => {
    if (selectedCategoryId === cat.id) {
      setSelectedCategoryId('');
      setSelectedSubcategoryId('');
    } else {
      setSelectedCategoryId(cat.id);
      if (cat.subcategories && cat.subcategories.length > 0) {
        setSelectedSubcategoryId(cat.subcategories[0].id);
      } else {
        setSelectedSubcategoryId('');
      }
    }
  };

  const handleSaveQuickSub = async () => {
    if (!newSubName.trim() || !selectedCategoryId) return;
    if (onAddSubcategory) {
      const newId = await onAddSubcategory(selectedCategoryId, newSubName.trim());
      setSelectedSubcategoryId(newId);
    }
    setNewSubName('');
    setQuickSubModalVisible(false);
  };

  const handleQuickSave = () => {
    onSave({
      categoryId: selectedCategoryId || undefined,
      subcategoryId: selectedSubcategoryId || undefined,
    });
  };

  const handleMoreOptions = () => {
    onOpenMoreOptions({
      categoryId: selectedCategoryId || undefined,
      subcategoryId: selectedSubcategoryId || undefined,
    });
  };

  if (!visible) return null;

  const isExpense = txType === 'expense';
  const accentColor = isExpense ? theme.error : theme.success;
  const accentContainer = isExpense ? theme.errorContainer : theme.successContainer;
  const onAccentContainer = isExpense ? theme.onErrorContainer : theme.onSuccessContainer;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetDismissArea} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: theme.surface },
            M3Elevation.level3,
          ]}
        >
          {/* Top Drag Handle */}
          <View style={styles.dragHandleRow}>
            <View style={[styles.dragHandlePill, { backgroundColor: theme.outlineVariant }]} />
          </View>

          {/* Header Row */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleCol}>
              <View style={styles.typeBadgeRow}>
                <View style={[styles.typeBadge, { backgroundColor: accentContainer }]}>
                  <MaterialCommunityIcons
                    name={isExpense ? 'arrow-down-circle' : 'arrow-up-circle'}
                    size={14}
                    color={accentColor}
                  />
                  <Text style={[styles.typeBadgeText, { color: onAccentContainer }]}>
                    {isExpense ? 'EXPENSE' : 'INCOME'}
                  </Text>
                </View>
                <Text style={[styles.headerAmountText, { color: theme.onSurface }]}>
                  {formatCurrency(amount, selectedWallet?.currency || baseCurrency)}
                </Text>
              </View>
              <Text style={[styles.walletSubText, { color: theme.onSurfaceVariant }]}>
                From {selectedWallet?.name || 'Wallet'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.pillBg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={18} color={theme.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
            SELECT CATEGORY
          </Text>

          {/* Category Grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesScrollContent}
          >
            <View style={styles.categoryGrid}>
              {activeCategories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                    onPress={() => handleSelectCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.catIconWrap,
                        { backgroundColor: cat.color || theme.primary },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={(cat.icon as any) || 'folder'}
                        size={18}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryName,
                        {
                          color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                        <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Add / Manage Categories */}
              {onManageCategories && (
                <TouchableOpacity
                  style={[
                    styles.categoryCard,
                    styles.manageCatCard,
                    { backgroundColor: theme.pillBg, borderColor: theme.outlineVariant },
                  ]}
                  onPress={() => {
                    onClose();
                    onManageCategories();
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="plus" size={20} color={theme.primary} />
                  <Text style={[styles.categoryName, { color: theme.primary, fontWeight: '700' }]}>
                    New
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Subcategories grid if category selected */}
            {selectedCategory && (
              <View style={styles.subcategoriesSection}>
                <Text style={[styles.subSectionLabel, { color: theme.onSurfaceVariant }]}>
                  SUBCATEGORY (OPTIONAL)
                </Text>
                <View style={styles.categoryGrid}>
                  {(selectedCategory.subcategories || []).map((sub: Subcategory) => {
                    const isSubSelected = sub.id === selectedSubcategoryId;
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        style={[
                          styles.categoryCard,
                          {
                            backgroundColor: isSubSelected ? theme.primaryContainer : theme.pillBg,
                            borderColor: isSubSelected ? theme.primary : 'transparent',
                          },
                        ]}
                        onPress={() =>
                          setSelectedSubcategoryId(isSubSelected ? '' : sub.id)
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.catIconWrap,
                            { backgroundColor: selectedCategory.color || theme.primary },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="label-outline"
                            size={16}
                            color="#FFFFFF"
                          />
                        </View>
                        <Text
                          style={[
                            styles.categoryName,
                            {
                              color: isSubSelected ? theme.onPrimaryContainer : theme.onSurface,
                              fontWeight: isSubSelected ? '700' : '500',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {sub.name}
                        </Text>
                        {isSubSelected && (
                          <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                            <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {/* + New Subcategory Button */}
                  <TouchableOpacity
                    style={[
                      styles.categoryCard,
                      styles.manageCatCard,
                      { backgroundColor: theme.pillBg, borderColor: theme.outlineVariant },
                    ]}
                    onPress={() => setQuickSubModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color={theme.primary} />
                    <Text style={[styles.categoryName, { color: theme.primary, fontWeight: '700' }]}>
                      New
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons Footer */}
          <View style={[styles.footerRow, { borderTopColor: theme.divider }]}>
            {/* More Options Button */}
            <TouchableOpacity
              style={[
                styles.moreOptionsBtn,
                { backgroundColor: theme.pillBg, borderColor: theme.outlineVariant },
              ]}
              onPress={handleMoreOptions}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="tune" size={18} color={theme.onSurface} />
              <Text style={[styles.moreOptionsText, { color: theme.onSurface }]}>
                More Options
              </Text>
            </TouchableOpacity>

            {/* Direct Save Button */}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: accentColor },
                M3Elevation.level2,
              ]}
              onPress={handleQuickSave}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                Save {isExpense ? 'Expense' : 'Income'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* QUICK NEW SUBCATEGORY MODAL */}
        {quickSubModalVisible && (
          <View style={styles.quickModalBackdrop}>
            <View style={[styles.quickModalBox, { backgroundColor: theme.surface }]}>
              <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>New Subcategory</Text>
              <Text style={[styles.quickModalSubtitle, { color: theme.onSurfaceVariant }]}>
                For {selectedCategory?.name}
              </Text>
              <TextInput
                style={[
                  styles.quickModalInput,
                  { backgroundColor: theme.pillBg, color: theme.onSurface },
                ]}
                placeholder="Subcategory Name (e.g. Dining Out)"
                placeholderTextColor={theme.onSurfaceVariant}
                value={newSubName}
                onChangeText={setNewSubName}
                autoFocus={true}
              />
              <View style={styles.quickModalBtnRow}>
                <TouchableOpacity
                  style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
                  onPress={() => {
                    setNewSubName('');
                    setQuickSubModalVisible(false);
                  }}
                >
                  <Text style={{ color: theme.onSurface }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickModalBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveQuickSub}
                >
                  <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: M3Shape.extraLarge,
    borderTopRightRadius: M3Shape.extraLarge,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 16,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  sheetTitleCol: {
    gap: 3,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: M3Shape.full,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerAmountText: {
    fontSize: 20,
    fontWeight: '800',
  },
  walletSubText: {
    fontSize: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  categoriesScroll: {
    maxHeight: 330,
  },
  categoriesScrollContent: {
    paddingBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: M3Shape.medium,
    borderWidth: 1.5,
    gap: 6,
    position: 'relative',
  },
  manageCatCard: {
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  catIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 12,
    flex: 1,
  },
  checkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcategoriesSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  subSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 14,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  moreOptionsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: M3Shape.large,
    borderWidth: 1,
  },
  moreOptionsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: M3Shape.large,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quickModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickModalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 12,
  },
  quickModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickModalSubtitle: {
    fontSize: 12,
    marginTop: -8,
  },
  quickModalInput: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: M3Shape.medium,
    fontSize: 14,
  },
  quickModalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  quickModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
});
