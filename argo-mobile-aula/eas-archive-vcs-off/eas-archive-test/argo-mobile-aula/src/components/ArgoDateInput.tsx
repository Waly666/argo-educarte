import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';
import {
  type ArgoDateView,
  buildMonthGrid,
  DIAS_CORTO,
  formatYmdDisplay,
  isYmdInRange,
  maskDateTyping,
  MESES_CORTO,
  MESES_LARGO,
  parseYmd,
  yearPageStart,
  yearsOnPage,
  ymdFromParts,
  ymdToday,
  YEARS_PER_PAGE,
} from '../utils/argoDateHelpers';

type Props = {
  label?: string;
  value: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  min?: string | null;
  max?: string | null;
  disabled?: boolean;
};

function ArgoDateInputInner({
  label,
  value,
  onChange,
  placeholder = 'DD/MM/AAAA',
  min = null,
  max = null,
  disabled = false,
}: Props) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [displayText, setDisplayText] = useState(() => formatYmdDisplay(value));
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ArgoDateView>('day');

  const anchor = parseYmd(value) || new Date();
  const [panelYear, setPanelYear] = useState(anchor.getFullYear());
  const [panelMonth, setPanelMonth] = useState(anchor.getMonth());
  const [yearPage, setYearPage] = useState(() => yearPageStart(anchor.getFullYear()));

  useEffect(() => {
    setDisplayText(formatYmdDisplay(value));
    const d = parseYmd(value);
    if (d) {
      setPanelYear(d.getFullYear());
      setPanelMonth(d.getMonth());
      setYearPage(yearPageStart(d.getFullYear()));
    }
  }, [value]);

  const selectedParts = useMemo(() => {
    const p = parseYmd(value);
    if (!p) return null;
    return { y: p.getFullYear(), m: p.getMonth(), d: p.getDate() };
  }, [value]);

  const monthDayCells = useMemo(() => {
    const grid = buildMonthGrid(panelYear, panelMonth);
    const prefix = `${panelYear}-${panelMonth}`;
    return grid.flatMap((row, rowIndex) =>
      row.map((day, colIndex) => ({
        key: `${prefix}-${rowIndex}-${colIndex}`,
        day,
      })),
    );
  }, [panelYear, panelMonth]);

  const panelTitle = useMemo(() => {
    if (view === 'year') {
      return `${yearPage} – ${yearPage + YEARS_PER_PAGE - 1}`;
    }
    if (view === 'month') return String(panelYear);
    return `${MESES_LARGO[panelMonth]} ${panelYear}`;
  }, [view, yearPage, panelYear, panelMonth]);

  const commitValue = useCallback(
    (ymd: string) => {
      onChange(ymd);
      setDisplayText(formatYmdDisplay(ymd));
    },
    [onChange],
  );

  const onTextBlur = useCallback(() => {
    const trimmed = displayText.trim();
    if (!trimmed) {
      commitValue('');
      return;
    }
    const d = parseYmd(trimmed);
    if (!d) {
      setDisplayText(formatYmdDisplay(value));
      return;
    }
    const ymd = ymdFromParts(d);
    if (!isYmdInRange(ymd, min, max)) {
      setDisplayText(formatYmdDisplay(value));
      return;
    }
    commitValue(ymd);
  }, [commitValue, displayText, max, min, value]);

  const openCalendar = useCallback(() => {
    if (disabled) return;
    const d = parseYmd(value) || new Date();
    setPanelYear(d.getFullYear());
    setPanelMonth(d.getMonth());
    setYearPage(yearPageStart(d.getFullYear()));
    setView('day');
    setOpen(true);
  }, [disabled, value]);

  const goPrev = useCallback(() => {
    if (view === 'year') {
      setYearPage((p) => p - YEARS_PER_PAGE);
      return;
    }
    if (view === 'month') {
      setPanelYear((y) => {
        const ny = y - 1;
        setYearPage(yearPageStart(ny));
        return ny;
      });
      return;
    }
    if (panelMonth === 0) {
      setPanelMonth(11);
      setPanelYear((y) => y - 1);
    } else {
      setPanelMonth((m) => m - 1);
    }
  }, [panelMonth, view]);

  const goNext = useCallback(() => {
    if (view === 'year') {
      setYearPage((p) => p + YEARS_PER_PAGE);
      return;
    }
    if (view === 'month') {
      setPanelYear((y) => {
        const ny = y + 1;
        setYearPage(yearPageStart(ny));
        return ny;
      });
      return;
    }
    if (panelMonth === 11) {
      setPanelMonth(0);
      setPanelYear((y) => y + 1);
    } else {
      setPanelMonth((m) => m + 1);
    }
  }, [panelMonth, view]);

  const pickDay = useCallback(
    (day: number) => {
      const ymd = ymdFromParts(new Date(panelYear, panelMonth, day));
      if (!isYmdInRange(ymd, min, max)) return;
      commitValue(ymd);
      setOpen(false);
    },
    [commitValue, max, min, panelMonth, panelYear],
  );

  const isDayDisabled = (day: number) => {
    const ymd = ymdFromParts(new Date(panelYear, panelMonth, day));
    return !isYmdInRange(ymd, min, max);
  };

  const isDaySelected = (day: number) =>
    !!selectedParts &&
    selectedParts.y === panelYear &&
    selectedParts.m === panelMonth &&
    selectedParts.d === day;

  const isToday = (day: number) => {
    const t = parseYmd(ymdToday());
    if (!t) return false;
    return t.getFullYear() === panelYear && t.getMonth() === panelMonth && t.getDate() === day;
  };

  return (
    <View style={styles.block}>
      {label ? (
        <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 6, fontWeight: '600' }}>
          {label}
        </ScaledText>
      ) : null}

      <View style={[styles.control, { borderColor: c.border, backgroundColor: c.inputBg, opacity: disabled ? 0.55 : 1 }]}>
        <TextInput
          value={displayText}
          onChangeText={(t) => setDisplayText(maskDateTyping(t))}
          onBlur={onTextBlur}
          placeholder={placeholder}
          placeholderTextColor={c.inputPlaceholder}
          keyboardType="numeric"
          editable={!disabled}
          style={[styles.textInput, { color: c.inputText }]}
        />
        <Pressable
          onPress={openCalendar}
          disabled={disabled}
          style={[styles.trigger, { borderLeftColor: c.border, backgroundColor: `${c.primary}12` }]}
          accessibilityLabel="Abrir calendario"
        >
          <Ionicons name="calendar-outline" size={20} color={c.primary} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.sheetHead, { borderBottomColor: c.border }]}>
            <Pressable onPress={goPrev} style={[styles.navBtn, { borderColor: c.border }]}>
              <ScaledText baseSize={20} style={{ color: c.text }}>‹</ScaledText>
            </Pressable>
            <View style={styles.titleWrap}>
              {view === 'day' ? (
                <>
                  <Pressable onPress={() => setView('month')}>
                    <ScaledText baseSize={15} style={{ color: c.primary, fontWeight: '700' }}>
                      {MESES_CORTO[panelMonth]}
                    </ScaledText>
                  </Pressable>
                  <Pressable onPress={() => { setYearPage(yearPageStart(panelYear)); setView('year'); }}>
                    <ScaledText baseSize={15} style={{ color: c.primary, fontWeight: '700' }}>
                      {panelYear}
                    </ScaledText>
                  </Pressable>
                </>
              ) : view === 'month' ? (
                <Pressable onPress={() => { setYearPage(yearPageStart(panelYear)); setView('year'); }}>
                  <ScaledText baseSize={15} style={{ color: c.primary, fontWeight: '700' }}>
                    {panelYear}
                  </ScaledText>
                </Pressable>
              ) : (
                <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700' }}>
                  {panelTitle}
                </ScaledText>
              )}
            </View>
            <Pressable onPress={goNext} style={[styles.navBtn, { borderColor: c.border }]}>
              <ScaledText baseSize={20} style={{ color: c.text }}>›</ScaledText>
            </Pressable>
          </View>

          {view === 'year' ? (
            <View style={styles.grid4}>
              {yearsOnPage(yearPage).map((y) => {
                const selected = selectedParts?.y === y;
                const current = y === new Date().getFullYear();
                return (
                  <Pressable
                    key={y}
                    onPress={() => {
                      setPanelYear(y);
                      setView('month');
                    }}
                    style={[
                      styles.gridCell,
                      { borderColor: c.border, backgroundColor: c.inputBg },
                      selected && { borderColor: c.primary, backgroundColor: `${c.primary}28` },
                      current && !selected && { borderColor: '#34d399' },
                    ]}
                  >
                    <ScaledText baseSize={14} style={{ color: selected ? c.primary : c.text, fontWeight: '700' }}>
                      {y}
                    </ScaledText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {view === 'month' ? (
            <View style={styles.grid4}>
              {MESES_CORTO.map((m, i) => {
                const selected = selectedParts?.y === panelYear && selectedParts?.m === i;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setPanelMonth(i);
                      setView('day');
                    }}
                    style={[
                      styles.gridCell,
                      { borderColor: c.border, backgroundColor: c.inputBg },
                      selected && { borderColor: c.primary, backgroundColor: `${c.primary}28` },
                    ]}
                  >
                    <ScaledText baseSize={14} style={{ color: selected ? c.primary : c.text, fontWeight: '600' }}>
                      {m}
                    </ScaledText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {view === 'day' ? (
            <>
              <View style={styles.weekRow}>
                {DIAS_CORTO.map((d) => (
                  <ScaledText key={d} baseSize={11} style={[styles.wd, { color: c.textSoft }]}>
                    {d}
                  </ScaledText>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {monthDayCells.map((cell) =>
                  cell.day == null ? (
                    <View key={cell.key} style={styles.dayEmpty} />
                  ) : (
                    <Pressable
                      key={cell.key}
                      disabled={isDayDisabled(cell.day)}
                      onPress={() => pickDay(cell.day!)}
                      style={[
                        styles.dayCell,
                        { borderColor: c.border, backgroundColor: c.inputBg },
                        isDaySelected(cell.day) && {
                          borderColor: c.primary,
                          backgroundColor: `${c.primary}35`,
                        },
                        isToday(cell.day) && !isDaySelected(cell.day) && { borderColor: '#34d399' },
                        isDayDisabled(cell.day) && { opacity: 0.35 },
                      ]}
                    >
                      <ScaledText
                        baseSize={14}
                        style={{
                          color: isDaySelected(cell.day) ? c.primary : c.text,
                          fontWeight: isDaySelected(cell.day) ? '800' : '600',
                        }}
                      >
                        {cell.day}
                      </ScaledText>
                    </Pressable>
                  ),
                )}
              </View>
            </>
          ) : null}

          <View style={[styles.foot, { borderTopColor: c.border }]}>
            <Pressable
              onPress={() => {
                commitValue('');
                setOpen(false);
              }}
              style={[styles.footBtn, { borderColor: c.border }]}
            >
              <ScaledText baseSize={13} style={{ color: c.textSoft, fontWeight: '600' }}>Limpiar</ScaledText>
            </Pressable>
            <Pressable
              onPress={() => {
                const t = ymdToday();
                if (!isYmdInRange(t, min, max)) return;
                commitValue(t);
                setOpen(false);
              }}
              style={[styles.footBtn, { borderColor: c.primary }]}
            >
              <ScaledText baseSize={13} style={{ color: c.primary, fontWeight: '700' }}>Hoy</ScaledText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export const ArgoDateInput = memo(ArgoDateInputInner);

const styles = StyleSheet.create({
  block: { marginBottom: space.md },
  control: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1.5,
    borderRadius: radius.md,
    overflow: 'hidden',
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  trigger: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space.md,
    marginBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
  grid4: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.md,
  },
  gridCell: {
    width: '22%',
    minWidth: '22%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: space.xs,
  },
  wd: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: space.md,
  },
  dayEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 2,
  },
  foot: {
    flexDirection: 'row',
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: space.sm + 2,
    alignItems: 'center',
  },
});
