import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ArrayPicker } from '@/components/data/ArrayPicker';
import { FieldPicker } from '@/components/data/FieldPicker';
import { OrderPicker } from '@/components/data/OrderPicker';
import { PositionPicker } from '@/components/data/PositionPicker';
import { StartCta } from '@/components/data/StartCta';
import { useShellDocking } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import type { SourceAnalysis } from '@/lib/import/analyze';
import { detectPositionFields } from '@/lib/import/positionField';
import { isPlainObject } from '@/lib/import/shape';
import { describeReadiness } from '@/lib/import/readiness';
import type { CoverageReading } from '@/lib/state/selectors';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { FieldRoles } from '@/types/source';

export interface FoundPanelProps {
  analysis: SourceAnalysis;
  selectedPath: string[] | null;
  roles: FieldRoles;
  alreadyRanked: boolean;
  /** True when these settings already are the document's defaults - see
   *  Workspace.listDefaults. */
  isDefault?: boolean;
  /** The entries of the selected array, resolved by the screen. */
  entries: unknown[];
  /** True while the source box is untouched, which is not a failed import. */
  isBlank: boolean;
  ctaLabel: string;
  /** Path key to ranking coverage for every candidate that already has
   *  progress behind it - see ArrayPicker. */
  rankedCoverages?: Record<string, CoverageReading>;
  /** Path key to the setup each list would be ranked with - see ArrayPicker. */
  configLines?: Record<string, string>;
  onSelectPath: (path: string[]) => void;
  onRolesChange: (roles: FieldRoles) => void;
  onAlreadyRankedChange: (alreadyRanked: boolean) => void;
  onSetAsDefault?: () => void;
  onSubmit: () => void;
}

function countOf(amount: number, noun: string): string {
  return `${amount} ${amount === 1 ? noun : `${noun}s`}`;
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
  isDefault = false,
  entries,
  isBlank,
  ctaLabel,
  rankedCoverages,
  configLines,
  onSelectPath,
  onRolesChange,
  onAlreadyRankedChange,
  onSetAsDefault,
  onSubmit,
}: FoundPanelProps) {
  // Kept while the entries are, so the field picker can keep what it worked out.
  const objects = useMemo(() => entries.filter(isPlainObject), [entries]);
  const docked = useShellDocking();
  const readiness = describeReadiness({
    candidates: analysis.candidates,
    selectedPath,
    entries,
    roles,
    hasIssues: analysis.issues.length > 0,
    isBlank,
  });

  return (
    <View style={[styles.panel, docked && styles.panelDocked]} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>What we found</Text>
        <Text style={styles.subtitle}>
          {isBlank
            ? 'Nothing yet'
            : entries.length > 0 || analysis.candidates.length <= 1
              ? countOf(entries.length, 'item')
              : countOf(analysis.candidates.length, 'list')}
        </Text>
      </View>

      {/* Docked on a phone, the panel runs with the page; scrolling inside it
          as well would leave two scrolls under one thumb. */}
      <Settings docked={docked}>
        <ArrayPicker
          candidates={analysis.candidates}
          value={selectedPath}
          onChange={onSelectPath}
          rankedCoverages={rankedCoverages}
          configLines={configLines}
        />

        <OrderPicker value={alreadyRanked} itemCount={entries.length} onChange={onAlreadyRankedChange} />

        {objects.length > 0 && <FieldPicker objects={objects} roles={roles} onChange={onRolesChange} />}

        <PositionPicker
          candidates={detectPositionFields(entries)}
          value={roles.positionField}
          onChange={(positionField) =>
            onRolesChange(
              positionField === undefined
                ? {
                    labelField: roles.labelField,
                    summaryFields: roles.summaryFields,
                    fieldRenderers: roles.fieldRenderers,
                  }
                : { ...roles, positionField },
            )
          }
        />

        {analysis.warnings.map((warning) => (
          <Text key={warning} style={styles.warning}>
            {warning}
          </Text>
        ))}

        {analysis.candidates.length > 1 && onSetAsDefault !== undefined && (
          <View style={styles.defaults}>
            <Button
              label="Set as default"
              accessibilityLabel="Set as default"
              variant="secondary"
              size="sm"
              disabled={isDefault}
              onPress={onSetAsDefault}
            />
            <Text style={styles.defaultsHint}>
              {isDefault
                ? 'These are the default. Lists you have not set up yourself follow them, here and in the list switcher.'
                : 'Lists you have not set up yourself follow these settings, here and in the list switcher.'}
            </Text>
          </View>
        )}
      </Settings>

      {/* On a phone the shell docks this at the bottom of the window instead. */}
      {!docked && (
        <StartCta label={ctaLabel} reason={readiness.reason} ready={readiness.ready} onSubmit={onSubmit} />
      )}
    </View>
  );
}

/** The panel's settings: their own scroll in a sidebar, plain content when docked. */
function Settings({ docked, children }: { docked: boolean; children: ReactNode }) {
  return docked ? (
    <View style={styles.bodyDocked}>{children}</View>
  ) : (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  defaults: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  defaultsHint: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  // The sidebar has a fixed height, so the settings scroll inside the panel's
  // border while the title and the call to action stay put.
  panel: {
    flex: 1,
    minHeight: 0,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  // Sized by its content, which the page scrolls, rather than filling a column.
  panelDocked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  bodyDocked: { gap: space.md },
  header: { gap: 2 },
  scroll: { flex: 1, minHeight: 0, marginHorizontal: -space.lg },
  body: { gap: space.md, paddingHorizontal: space.lg },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  warning: { fontFamily: fonts.body, fontSize: 12, color: colors.warningText },
});
