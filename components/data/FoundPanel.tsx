import { StyleSheet, Text, View } from 'react-native';

import { AlreadyRankedToggle } from '@/components/data/AlreadyRankedToggle';
import { ArrayPicker } from '@/components/data/ArrayPicker';
import { LabelPicker } from '@/components/data/LabelPicker';
import { PositionPicker } from '@/components/data/PositionPicker';
import { Button } from '@/components/ui/Button';
import type { SourceAnalysis } from '@/lib/import/analyze';
import { collectLabelFieldCandidates, describeObjectSchema } from '@/lib/import/labelField';
import { detectPositionFields } from '@/lib/import/positionField';
import { describeReadiness } from '@/lib/import/readiness';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ComplexItemValue } from '@/types/list';
import type { FieldRoles } from '@/types/source';

export interface FoundPanelProps {
  analysis: SourceAnalysis;
  selectedPath: string[] | null;
  roles: FieldRoles;
  alreadyRanked: boolean;
  /** The entries of the selected array, resolved by the screen. */
  entries: unknown[];
  ctaLabel: string;
  onSelectPath: (path: string[]) => void;
  onRolesChange: (roles: FieldRoles) => void;
  onAlreadyRankedChange: (alreadyRanked: boolean) => void;
  onSubmit: () => void;
}

function isPlainObject(value: unknown): value is ComplexItemValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What the app understood, and the few decisions it cannot make alone. A plain
 * list resolves everything on its own, so this panel shows only a count.
 */
export function FoundPanel({
  analysis,
  selectedPath,
  roles,
  alreadyRanked,
  entries,
  ctaLabel,
  onSelectPath,
  onRolesChange,
  onAlreadyRankedChange,
  onSubmit,
}: FoundPanelProps) {
  const objects = entries.filter(isPlainObject);
  const readiness = describeReadiness({
    candidates: analysis.candidates,
    selectedPath,
    entries,
    roles,
    hasIssues: analysis.issues.length > 0,
  });

  // The label picker asks for itself, right beside the options. Repeating that
  // ask down here would say the same sentence twice on one screen.
  const askedByPicker = objects.length > 0 && roles.labelField === undefined;

  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>What we found</Text>
        <Text style={styles.subtitle}>
          {entries.length > 0 || analysis.candidates.length <= 1
            ? `${entries.length} items`
            : `${analysis.candidates.length} lists`}
        </Text>
      </View>

      <ArrayPicker candidates={analysis.candidates} value={selectedPath} onChange={onSelectPath} />

      <AlreadyRankedToggle value={alreadyRanked} onChange={onAlreadyRankedChange} />

      {objects.length > 0 && (
        <LabelPicker
          candidates={collectLabelFieldCandidates(objects)}
          schema={describeObjectSchema(objects)}
          value={roles.labelField}
          onChange={(labelField) => onRolesChange({ ...roles, labelField })}
        />
      )}

      <PositionPicker
        candidates={detectPositionFields(entries)}
        value={roles.positionField}
        onChange={(positionField) =>
          onRolesChange(
            positionField === undefined
              ? { labelField: roles.labelField }
              : { ...roles, positionField },
          )
        }
      />

      {analysis.warnings.map((warning) => (
        <Text key={warning} style={styles.warning}>
          {warning}
        </Text>
      ))}

      {readiness.reason !== undefined && !askedByPicker && (
        <Text style={styles.reason}>{readiness.reason}</Text>
      )}

      <Button
        label={ctaLabel}
        variant="primary"
        disabled={!readiness.ready}
        onPress={onSubmit}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { gap: 2 },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  warning: { fontFamily: fonts.body, fontSize: 12, color: colors.warningText },
  reason: { fontFamily: fonts.body, fontSize: 13, color: colors.accentStrong },
  cta: { alignSelf: 'stretch' },
});
