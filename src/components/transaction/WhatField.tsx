import React from 'react';
import { Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Category, Subcategory } from '../../types';
import { M3Shape } from '../../theme';
import { transactionFormStyles as styles } from './styles';
import { TransactionFormState } from './useTransactionForm';

interface WhatFieldProps {
  form: TransactionFormState;
  categories: Category[];
  theme: any;
  onManageCategories?: () => void;
  onAddSubcategory?: (categoryId: string, name: string) => Promise<string>;
}

export const WhatField: React.FC<WhatFieldProps> = ({
  form,
  categories,
  theme,
  onManageCategories,
  onAddSubcategory,
}) => {
  const {
    formKind,
    iouAction,
    iouIncludeMyShare,
    activeSheet,
    setActiveSheet,
    selectedCategory,
    selectedSubcategory,
    selectedCategoryId,
    selectedSubcategoryId,
    setSelectedSubcategoryId,
    expandedCategoryId,
    setExpandedCategoryId,
    handleSelectCategory,
    setLastExpenseSubId,
    setLastIncomeSubId,
    currentType,
    setQuickSubModalVisible,
    animateLayout,
    focusAmountInput,
  } = form;

  // Hidden for Transfer, Loan Settle, or Loan when own share is excluded
  if (formKind === 'transfer') return null;
  if (formKind === 'loan' && (iouAction === 'settle' || !iouIncludeMyShare)) return null;

  const targetCatType = formKind === 'loan' ? 'expense' : currentType;
  const displayedCategories = categories.filter((c) => c.type === targetCatType);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={() => {
          animateLayout();
          const next = activeSheet === 'category' ? null : 'category';
          if (next) Keyboard.dismiss();
          setActiveSheet(next);
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Toggle category sheet"
      >
        <View style={styles.accordionHeaderLeft}>
          <View
            style={[
              styles.catIconWrap,
              { backgroundColor: selectedCategory?.color || theme.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name={(selectedCategory?.icon as any) || 'shape-outline'}
              size={16}
              color={selectedCategory ? '#FFFFFF' : theme.primary}
            />
          </View>
          <View style={styles.accordionTitleCol}>
            <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
              {formKind === 'loan' ? 'CATEGORY (OPTIONAL)' : 'CATEGORY'}
            </Text>
            {selectedCategory ? (
              <Text style={[styles.categoryBreadcrumbText, { color: theme.onSurface }]} numberOfLines={1}>
                <Text style={{ fontWeight: '700' }}>{selectedCategory.name}</Text>
                {selectedSubcategory ? (
                  <Text style={{ color: theme.primary, fontWeight: '600' }}>
                    {` › ${selectedSubcategory.name}`}
                  </Text>
                ) : null}
              </Text>
            ) : (
              <Text style={[styles.categoryPlaceholderText, { color: theme.onSurfaceVariant }]}>
                Tap to choose category
              </Text>
            )}
          </View>
        </View>

        <View style={styles.accordionHeaderRight}>
          {onManageCategories && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onManageCategories();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.manageLink, { color: theme.primary }]}>Manage</Text>
            </TouchableOpacity>
          )}
          <MaterialCommunityIcons
            name={activeSheet === 'category' ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.onSurfaceVariant}
          />
        </View>
      </TouchableOpacity>

      {activeSheet === 'category' && (
        <View style={[styles.sheetListWrap, { borderTopColor: theme.divider }]}>
          {displayedCategories.length === 0 ? (
            <Text style={[styles.emptySheetText, { color: theme.onSurfaceVariant }]}>
              No categories available
            </Text>
          ) : (
            displayedCategories.map((cat) => {
              const isSelected = cat.id === selectedCategoryId;
              const isExpanded = expandedCategoryId === cat.id;
              const subs = cat.subcategories || [];

              return (
                <View key={cat.id} style={styles.catGroupBlock}>
                  <View
                    style={[
                      styles.catSheetRow,
                      {
                        backgroundColor: isSelected ? theme.primaryContainer : theme.pillBg,
                        borderColor: isSelected ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.catSheetRowMain}
                      onPress={() => {
                        animateLayout();
                        handleSelectCategory(cat);
                        if (subs.length > 0) {
                          setExpandedCategoryId(cat.id);
                        } else {
                          setActiveSheet(null);
                          setTimeout(focusAmountInput, 140);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.catSheetIconBadge, { backgroundColor: cat.color }]}>
                        <MaterialCommunityIcons name={cat.icon as any} size={16} color="#FFFFFF" />
                      </View>
                      <Text
                        style={[
                          styles.catSheetRowTitle,
                          {
                            color: isSelected ? theme.onPrimaryContainer : theme.onSurface,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                      {subs.length > 0 && (
                        <Text style={[styles.catSubCountBadge, { color: theme.onSurfaceVariant }]}>
                          {subs.length}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {(subs.length > 0 || onAddSubcategory) && (
                      <TouchableOpacity
                        style={[
                          styles.catDropperBtn,
                          {
                            backgroundColor: isExpanded ? theme.primary : theme.surface,
                            borderColor: isExpanded ? theme.primary : theme.divider,
                          },
                        ]}
                        onPress={() => {
                          animateLayout();
                          setExpandedCategoryId(isExpanded ? null : cat.id);
                        }}
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

                  {isExpanded && (
                    <View style={[styles.subcatSheetList, { borderLeftColor: theme.divider }]}>
                      {subs.map((sub: Subcategory) => {
                        const isSubSel = sub.id === selectedSubcategoryId;
                        return (
                          <TouchableOpacity
                            key={sub.id}
                            style={[
                              styles.subcatSheetRow,
                              {
                                backgroundColor: isSubSel ? theme.primaryContainer : theme.surface,
                                borderColor: isSubSel ? theme.primary : theme.divider,
                              },
                            ]}
                            onPress={() => {
                              animateLayout();
                              if (!isSelected) {
                                handleSelectCategory(cat);
                              }
                              const nextSubId = isSubSel ? '' : sub.id;
                              setSelectedSubcategoryId(nextSubId);
                              if (currentType === 'expense') {
                                setLastExpenseSubId(nextSubId);
                              } else if (currentType === 'income') {
                                setLastIncomeSubId(nextSubId);
                              }
                              setActiveSheet(null);
                              setTimeout(focusAmountInput, 140);
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons
                              name="subdirectory-arrow-right"
                              size={15}
                              color={isSubSel ? theme.primary : theme.onSurfaceVariant}
                            />
                            <Text
                              style={[
                                styles.subcatSheetRowText,
                                {
                                  color: isSubSel ? theme.onPrimaryContainer : theme.onSurface,
                                  fontWeight: isSubSel ? '700' : '500',
                                },
                              ]}
                            >
                              {sub.name}
                            </Text>
                            {isSubSel && (
                              <MaterialCommunityIcons name="check-circle" size={16} color={theme.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}

                      {onAddSubcategory && (
                        <TouchableOpacity
                          style={[
                            styles.subcatSheetRow,
                            {
                              backgroundColor: theme.pillBg,
                              borderColor: theme.primary,
                              borderStyle: 'dashed',
                            },
                          ]}
                          onPress={() => {
                            if (!isSelected) {
                              handleSelectCategory(cat);
                            }
                            setQuickSubModalVisible(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="plus" size={16} color={theme.primary} />
                          <Text style={[styles.subcatSheetRowText, { color: theme.primary, fontWeight: '700' }]}>
                            Add Subcategory
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
};
