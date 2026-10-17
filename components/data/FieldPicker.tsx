import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldLink } from '@/components/preview/FieldLink';
import { FieldPicture } from '@/components/preview/FieldPicture';
import { FieldValue } from '@/components/preview/FieldValue';
import { PreviewButton, PreviewButtonPlaceholder } from '@/components/preview/PreviewButton';
import { drawsFlags } from '@/lib/browser/flagSupport';
import { colors, fonts, radius, space } from '@/lib/theme';
import { describeObjectSchema } from '@/lib/import/labelField';
import type { ObjectSchemaField } from '@/lib/import/labelField';
import {
  cleanRenderers,
  formatValue,
  isLink,
  linkText,
  picturesOf,
  previewSourceOf,
  ratingScale,
  rendererCaveat,
  rendererOptionsFor,
  slotOf,
} from '@/lib/renderers';
import type { RendererOption } from '@/lib/renderers';
import { summaryText } from '@/lib/state/summary';
import type { ComplexItemValue } from '@/types/list';
import type { FieldRenderer, FieldRoles } from '@/types/source';

const MAX_SAMPLES = 3;

/** How one field appears on a card: its title, a detail drawn some way, or not at all. */
type FieldStyle =
  | { kind: 'title' }
  | { kind: 'detail'; renderer: FieldRenderer | undefined }
  | { kind: 'hidden' };

export interface FieldPickerProps {
  objects: ComplexItemValue[];
  roles: FieldRoles;
  onChange: (roles: FieldRoles) => void;
}

/** Every value the field holds, for deciding what it can be drawn as. */
function valuesOf(objects: ComplexItemValue[], field: string): unknown[] {
  return objects.map((object) => object[field]).filter((value) => value !== undefined);
}

/** A few distinct values, the raw value kept beside its text. */
function samplesOf(values: unknown[]): Sample[] {
  const samples = new Map<string, unknown>();
  for (const value of values) {
    const text = summaryText(value);
    if (!samples.has(text)) samples.set(text, value);
    if (samples.size >= MAX_SAMPLES) break;
  }
  return [...samples].map(([text, raw]) => ({ text, raw }));
}

interface Sample {
  text: string;
  raw: unknown;
}

function styleOf(field: string, roles: FieldRoles): FieldStyle {
  if (field === roles.labelField) return { kind: 'title' };
  if (roles.summaryFields?.includes(field)) {
    return { kind: 'detail', renderer: roles.fieldRenderers?.[field] };
  }
  return { kind: 'hidden' };
}

function rendererOf(style: FieldStyle): FieldRenderer | undefined {
  return style.kind === 'detail' ? style.renderer : undefined;
}

/** The field's sample values, drawn the way a card would draw them. */
function StylePreview({ style, samples, field }: { style: FieldStyle; samples: Sample[]; field: string }) {
  const renderer = rendererOf(style);
  if (slotOf(renderer) === 'media') return <PreviewButtonPlaceholder />;
  if (slotOf(renderer) === 'picture') {
    // A gallery's first value alone can fill the row, so pictures are counted, not values.
    const pictures = samples
      .flatMap((sample) => picturesOf(sample.raw, renderer).map((picture) => ({ picture, label: sample.text })))
      .slice(0, MAX_SAMPLES);
    return (
      <View style={styles.thumbs}>
        {pictures.map(({ picture, label }, index) => (
          <FieldPicture
            key={`${index}-${picture.uri}`}
            picture={picture}
            // A wide banner keeps its height near a square thumbnail's.
            size={picture.aspect > 1 ? 64 : 32}
            label={label}
            linked={false}
          />
        ))}
      </View>
    );
  }
  // A few values side by side, each drawn: the colours are the point.
  if (renderer === 'pills' || renderer === 'color-swatch') {
    return (
      <View style={[styles.thumbs, styles.wrap]}>
        {samples.map((sample) => (
          <FieldValue key={sample.text} field={field} value={sample.raw} renderer={renderer} textStyle={styles.samples} />
        ))}
      </View>
    );
  }
  if (renderer === 'long-text') {
    return (
      <Text style={styles.samples} numberOfLines={2}>
        {formatValue(samples[0]?.raw, renderer, field)}
      </Text>
    );
  }
  if (renderer === 'link') {
    return (
      <Text style={[styles.samples, styles.samplesLink]} numberOfLines={1}>
        {samples.map((sample) => (isLink(sample.raw) ? linkText(sample.raw) : sample.text)).join(' · ')}
      </Text>
    );
  }
  // Drawn rather than written: one value shows the look better than three crowd it.
  if (renderer === 'tags' || renderer === 'badge' || ratingScale(renderer) !== undefined) {
    // A badge shows nothing for false, so the preview looks for a true one.
    const sample = renderer === 'badge' ? (samples.find((entry) => entry.raw === true) ?? samples[0]) : samples[0];
    if (sample === undefined) return null;
    if (renderer === 'badge' && sample.raw !== true) {
      return <Text style={[styles.samples, styles.samplesHidden]}>Never true, so never shown</Text>;
    }
    return <FieldValue field={field} value={sample.raw} renderer={renderer} textStyle={styles.samples} />;
  }
  if (renderer !== undefined) {
    return (
      <Text style={styles.samples} numberOfLines={1}>
        {samples.map((sample) => formatValue(sample.raw, renderer, field) ?? sample.text).join(' · ')}
      </Text>
    );
  }
  return (
    <Text
      style={[
        styles.samples,
        style.kind === 'title' && styles.samplesTitle,
        style.kind === 'hidden' && styles.samplesHidden,
      ]}
      numberOfLines={1}
    >
      {samples.map((sample) => sample.text).join(' · ')}
    </Text>
  );
}

/**
 * One way to draw a field, previewed with its own values. Stars and bars also
 * need to know what the score is out of, so they offer each scale that fits
 * every value - the choice is the scale, and the preview follows it.
 */
function RendererChoice({
  field,
  option,
  current,
  isShown,
  samples,
  onChoose,
}: {
  field: string;
  option: RendererOption;
  current: FieldRenderer | undefined;
  isShown: boolean;
  samples: Sample[];
  onChoose: (renderer: FieldRenderer | undefined) => void;
}) {
  const name = option.id === undefined ? 'Text' : option.label;
  const hint = option.id === undefined ? option.label : option.hint;

  if (option.variants !== undefined) {
    const prompt = option.variantPrompt ?? '';
    const chosen = option.variants.find((entry) => entry.id === current && isShown);
    const previewed = chosen?.id ?? option.id;
    return (
      <View style={[styles.choice, chosen !== undefined && styles.choiceActive]}>
        <View style={styles.nameRow}>
          <Text style={[styles.choiceName, chosen !== undefined && styles.fieldSelected]}>{name}</Text>
          <Text style={styles.choiceHint}>{hint}</Text>
        </View>
        <View style={styles.scales} role="radiogroup" aria-label={`${name} ${prompt}`}>
          <Text style={styles.choiceHint}>{prompt}</Text>
          {option.variants.map((entry) => {
            const active = entry.id === chosen?.id;
            return (
              <Pressable
                key={entry.id}
                role="radio"
                accessibilityLabel={`Show ${field} as ${name} ${prompt} ${entry.label}`}
                aria-checked={active}
                onPress={() => onChoose(entry.id)}
                style={[styles.scale, active && styles.scaleActive]}
              >
                <Text style={[styles.scaleText, active && styles.fieldSelected]}>{entry.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <StylePreview style={{ kind: 'detail', renderer: previewed }} samples={samples} field={field} />
      </View>
    );
  }

  const active = isShown && current === option.id;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${field} as ${option.id === undefined ? 'text' : option.label}`}
      aria-pressed={active}
      onPress={() => onChoose(option.id)}
      style={[styles.choice, active && styles.choiceActive]}
    >
      <View style={styles.nameRow}>
        <Text style={[styles.choiceName, active && styles.fieldSelected]}>{name}</Text>
        <Text style={styles.choiceHint}>{hint}</Text>
      </View>
      <StylePreview style={{ kind: 'detail', renderer: option.id }} samples={samples} field={field} />
    </Pressable>
  );
}

/**
 * Every field of the list's objects in one place, arranged the way a card
 * reads top to bottom: the title, then the details shown under it in order,
 * then everything else.
 *
 * Each control does one thing. Tapping a field makes it the title. The box on
 * its left puts it on the card, numbered by position, and the arrows move it.
 * The button on its right picks how it is drawn, previewed in the cell itself.
 */
export function FieldPicker({ objects, roles, onChange }: FieldPickerProps) {
  const [openField, setOpenField] = useState<string | null>(null);
  const schema = useMemo(() => describeObjectSchema(objects), [objects]);
  // Every field's values, samples and renderer choices: a scan of every entry,
  // so it is done when the entries change rather than on every choice made.
  const facts = useMemo(
    () =>
      new Map(
        schema.fields.map((field) => {
          const values = valuesOf(objects, field.field);
          return [field.field, { values, samples: samplesOf(values), options: rendererOptionsFor(values, field.field) }];
        }),
      ),
    [objects, schema],
  );
  const title = roles.labelField;
  const shown = roles.summaryFields ?? [];

  if (!schema.fields.some((field) => field.labelCandidate)) {
    return (
      <View style={styles.group}>
        <Text style={styles.heading}>Fields</Text>
        <Text style={styles.prompt}>
          No fields on these objects can title a card. Import objects with a text or number field.
        </Text>
      </View>
    );
  }

  const commit = (labelField: string | undefined, summaryFields: string[], renderers: FieldRoles['fieldRenderers']) =>
    onChange({
      ...roles,
      labelField,
      // Emptying a selection is a choice of its own; only never having chosen stays absent.
      summaryFields: summaryFields.length === 0 && roles.summaryFields === undefined ? undefined : summaryFields,
      fieldRenderers: cleanRenderers(renderers, summaryFields),
    });

  const apply = (field: string, next: FieldStyle) => {
    const { [field]: _dropped, ...otherRenderers } = roles.fieldRenderers ?? {};
    const others = shown.filter((entry) => entry !== field);
    if (next.kind === 'title') {
      commit(field, others, otherRenderers);
    } else if (next.kind === 'hidden') {
      commit(title, others, otherRenderers);
    } else {
      // Keeps its place if already shown; otherwise joins the end.
      const summaryFields = shown.includes(field) ? shown : [...shown, field];
      commit(
        title,
        summaryFields,
        next.renderer === undefined ? otherRenderers : { ...otherRenderers, [field]: next.renderer },
      );
    }
  };

  const move = (field: string, by: -1 | 1) => {
    const from = shown.indexOf(field);
    const to = from + by;
    if (from < 0 || to < 0 || to >= shown.length) return;
    const summaryFields = [...shown];
    [summaryFields[from], summaryFields[to]] = [summaryFields[to]!, summaryFields[from]!];
    commit(title, summaryFields, roles.fieldRenderers);
  };

  const byName = new Map(schema.fields.map((field) => [field.field, field]));
  const titleField = title === undefined ? undefined : byName.get(title);
  const details = shown.flatMap((field) => byName.get(field) ?? []);
  const onCard = [...(titleField === undefined ? [] : [titleField]), ...details];
  const rest = schema.fields.filter((field) => field.field !== title && !shown.includes(field.field));

  const cardField = (other: string) => ({ field: other, renderer: roles.fieldRenderers?.[other] });

  const renderCell = (field: ObjectSchemaField) => {
    const current = styleOf(field.field, roles);
    const isTitle = current.kind === 'title';
    const isShown = current.kind === 'detail';
    const order = shown.indexOf(field.field) + 1;
    const open = openField === field.field;
    const { values, samples, options: renderers } = facts.get(field.field)!;
    const plays = slotOf(rendererOf(current)) === 'media';
    // Only for a field on the card: a hidden one is drawn nowhere.
    const caveat = isShown
      ? rendererCaveat(rendererOf(current), values, {
          field: field.field,
          earlier: shown.slice(0, order - 1).map(cardField),
          later: shown.slice(order).map(cardField),
          drawsFlags: drawsFlags(),
        })
      : undefined;
    const hasMenu = !isTitle && renderers.length > 1;

    return (
      <View key={field.field} style={[styles.cell, (isTitle || isShown) && styles.cellSelected]}>
        <View style={styles.cellRow}>
          {isTitle ? (
            <View style={styles.lead}>
              <View style={[styles.box, styles.boxTitle]}>
                <Text style={styles.boxText}>T</Text>
              </View>
            </View>
          ) : (
            <Pressable
              role="checkbox"
              accessibilityLabel={`Show ${field.field} on cards`}
              aria-checked={isShown}
              onPress={() => apply(field.field, isShown ? { kind: 'hidden' } : { kind: 'detail', renderer: undefined })}
              style={styles.lead}
            >
              <View style={[styles.box, isShown && styles.boxChecked]}>
                {isShown && <Text style={styles.boxText}>{`${order}`}</Text>}
              </View>
            </Pressable>
          )}

          <View style={styles.mainColumn}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Label items by ${field.field}`}
              aria-pressed={isTitle}
              disabled={!field.labelCandidate}
              onPress={() => {
                if (!isTitle) apply(field.field, { kind: 'title' });
              }}
              style={[styles.main, rendererOf(current) === 'link' && styles.mainAboveLink]}
            >
              <View style={styles.nameRow}>
                <Text style={[styles.field, (isTitle || isShown) && styles.fieldSelected]} numberOfLines={1}>
                  {field.field}
                </Text>
                {isTitle && <Text style={styles.badge}>Title</Text>}
                {field.coverage < 1 && (
                  <Text style={styles.warning}>
                    {`${Math.round(field.coverage * schema.itemCount)} of ${schema.itemCount}`}
                  </Text>
                )}
              </View>
              {/* A play button is the whole preview, and it sits on the right. */}
              {rendererOf(current) !== 'link' && !plays && (
                <StylePreview style={current} samples={samples} field={field.field} />
              )}
            </Pressable>
            {/* Working controls, so they stay outside the cell's own button:
                using one never also makes the field the title. */}
            {rendererOf(current) === 'link' && isLink(samples[0]?.raw) && (
              <View style={styles.liveLink}>
                <FieldLink url={samples[0].raw} />
              </View>
            )}
          </View>

          {plays && (
            <View style={styles.play}>
              <PreviewButton
                sources={[previewSourceOf(samples[0]?.raw, rendererOf(current))].flatMap((source) => source ?? [])}
                label={`${field.field} sample`}
                compact
                placeholder={<PreviewButtonPlaceholder />}
              />
            </View>
          )}

          {isShown && (
            <View style={[styles.side, styles.sideSelected]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${field.field} up`}
                disabled={order === 1}
                onPress={() => move(field.field, -1)}
                style={[styles.arrow, order === 1 && styles.arrowIdle]}
              >
                <Text style={[styles.glyph, styles.fieldSelected]}>▲</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${field.field} down`}
                disabled={order === shown.length}
                onPress={() => move(field.field, 1)}
                style={[styles.arrow, order === shown.length && styles.arrowIdle]}
              >
                <Text style={[styles.glyph, styles.fieldSelected]}>▼</Text>
              </Pressable>
            </View>
          )}

          {hasMenu && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose how ${field.field} is drawn`}
              aria-expanded={open}
              onPress={() => setOpenField(open ? null : field.field)}
              style={[styles.side, isShown && styles.sideSelected, open && styles.sideOpen]}
            >
              <Text style={[styles.glyph, styles.chevron, isShown && styles.fieldSelected]}>{open ? '▴' : '▾'}</Text>
            </Pressable>
          )}
        </View>

        {caveat !== undefined && (
          <View style={styles.caveat}>
            <Text style={[styles.caveatText, caveat.tone === 'warning' && styles.caveatWarning]}>{caveat.text}</Text>
            {caveat.order !== undefined && (
              <View role="list">
                {caveat.order.map((entry, index) => (
                  <Text key={entry.field} role="listitem" style={styles.caveatText}>
                    {`${index + 1}. `}
                    <Text style={entry.current ? styles.caveatCurrent : styles.caveatField}>{entry.field}</Text>
                    {entry.current ? ' (this field)' : ''}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {open && hasMenu && (
          <View style={styles.menu}>
            {renderers.map((option) => (
              <RendererChoice
                key={option.label}
                field={field.field}
                option={option}
                current={rendererOf(current)}
                isShown={isShown}
                samples={samples}
                onChoose={(renderer) => {
                  apply(field.field, { kind: 'detail', renderer });
                  setOpenField(null);
                }}
              />
            ))}
            {!isShown && (
              <Text style={styles.choiceHint}>
                Choosing one also adds this field to the cards.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.group}>
      <Text style={styles.heading}>Fields</Text>
      <Text style={styles.prompt}>
        Tap a field to make it the title. Tick any others to show under it, and use the arrows to set their order.
      </Text>

      {onCard.length > 0 && (
        <>
          <Text style={styles.section}>
            {`On each card · ${details.length} ${details.length === 1 ? 'detail' : 'details'}`}
          </Text>
          <View style={styles.cells}>{onCard.map(renderCell)}</View>
        </>
      )}

      {rest.length > 0 && (
        <>
          <Text style={styles.section}>Other fields</Text>
          <View style={styles.cells}>{rest.map(renderCell)}</View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // A question, not the primary action, so it stays off the accent colour.
  prompt: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  section: {
    marginTop: space.sm,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  cells: { gap: space.xs },
  cell: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  cellSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  // One height for every cell, so a one-line field and a two-line one share a
  // rhythm, and the stacked arrows always have room.
  cellRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 60 },
  lead: { width: 40, alignItems: 'center', justifyContent: 'center' },
  box: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    // Stronger than a hairline: an empty box has only its outline to say it is there.
    borderColor: colors.textFaint,
  },
  boxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  boxTitle: { borderColor: colors.accentStrong, backgroundColor: colors.accentStrong },
  boxText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '700', color: colors.accentContrast },
  mainColumn: { flex: 1, minWidth: 0, justifyContent: 'center' },
  main: {
    gap: 4,
    paddingVertical: 10,
    paddingRight: space.md,
  },
  mainAboveLink: { paddingBottom: 2 },
  liveLink: { alignItems: 'flex-start', paddingRight: space.md, paddingBottom: space.sm },
  // Under the whole cell, so it reads with the field and not with a control.
  caveat: {
    gap: 2,
    paddingTop: space.xs,
    paddingBottom: space.sm,
    paddingHorizontal: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.accentSoftBorder,
  },
  caveatText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.textSecondary },
  caveatField: { fontFamily: fonts.mono },
  caveatCurrent: { fontFamily: fonts.mono, fontWeight: '600', color: colors.accentStrong },
  caveatWarning: { color: colors.warningText },
  play: { justifyContent: 'center', paddingHorizontal: space.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 0 },
  field: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  fieldSelected: { color: colors.accentStrong },
  badge: {
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentStrong,
  },
  warning: { marginLeft: 'auto', fontFamily: fonts.body, fontSize: 11, color: colors.warningText },
  samples: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  samplesTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  samplesHidden: { color: colors.textFaint },
  samplesLink: { color: colors.accentStrong, textDecorationLine: 'underline' },
  thumbs: { flexDirection: 'row', gap: space.xs, marginTop: 2 },
  // Drawn values wrap rather than run under the controls beside them.
  wrap: { flexWrap: 'wrap', rowGap: 4, minWidth: 0 },
  side: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  sideSelected: { borderLeftColor: colors.accentSoftBorder },
  sideOpen: { backgroundColor: colors.surface },
  arrow: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  arrowIdle: { opacity: 0.3 },
  glyph: { fontFamily: fonts.body, fontSize: 10, color: colors.textSecondary },
  chevron: { fontSize: 15 },
  menu: {
    gap: space.xs,
    padding: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  choice: {
    gap: 2,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scales: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, marginVertical: 2 },
  scale: {
    minWidth: 30,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  scaleActive: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  scaleText: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  choiceActive: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  choiceName: { flexShrink: 0, fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  choiceHint: { flexShrink: 1, fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  disabled: { opacity: 0.45 },
});
