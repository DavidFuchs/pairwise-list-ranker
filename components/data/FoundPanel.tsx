import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ArrayPicker } from "@/components/data/ArrayPicker";
import { FieldPicker } from "@/components/data/FieldPicker";
import { OrderPicker } from "@/components/data/OrderPicker";
import { PositionPicker } from "@/components/data/PositionPicker";
import { Button } from "@/components/ui/Button";
import type { SourceAnalysis } from "@/lib/import/analyze";
import { detectPositionFields } from "@/lib/import/positionField";
import { isPlainObject } from "@/lib/import/shape";
import { describeReadiness } from "@/lib/import/readiness";
import type { CoverageReading } from "@/lib/state/selectors";
import { colors, fonts, radius, space, typeScale } from "@/lib/theme";
import type { FieldRoles } from "@/types/source";

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
  const readiness = describeReadiness({
    candidates: analysis.candidates,
    selectedPath,
    entries,
    roles,
    hasIssues: analysis.issues.length > 0,
    isBlank,
  });

  return (
    <View style={styles.panel} dataSet={{ surface: "panel" }}>
      <View style={styles.header}>
        <Text style={styles.title}>What we found</Text>
        <Text style={styles.subtitle}>
          {isBlank
            ? "Nothing yet"
            : entries.length > 0 || analysis.candidates.length <= 1
              ? countOf(entries.length, "item")
              : countOf(analysis.candidates.length, "list")}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <ArrayPicker
          candidates={analysis.candidates}
          value={selectedPath}
          onChange={onSelectPath}
          rankedCoverages={rankedCoverages}
          configLines={configLines}
        />

        <OrderPicker
          value={alreadyRanked}
          itemCount={entries.length}
          onChange={onAlreadyRankedChange}
        />

        {objects.length > 0 && (
          <FieldPicker
            objects={objects}
            roles={roles}
            onChange={onRolesChange}
          />
        )}

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
                ? "These are the default. Lists you have not set up yourself follow them, here and in the list switcher."
                : "Lists you have not set up yourself follow these settings, here and in the list switcher."}
            </Text>
          </View>
        )}
      </ScrollView>

      {readiness.reason !== undefined && (
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
  defaults: { flexDirection: "row", alignItems: "center", gap: space.md },
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
  header: { gap: 2 },
  scroll: { flex: 1, minHeight: 0, marginHorizontal: -space.lg },
  body: { gap: space.md, paddingHorizontal: space.lg },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  warning: { fontFamily: fonts.body, fontSize: 12, color: colors.warningText },
  // Plain text, like every other hint here. A sunken fill inside a hairline
  // border is this app's word for "you can interact with this" - it is the
  // editor, the format tabs, and every picker option - so a read-only message
  // wearing it reads as a field to type in, especially above a submit button.
  reason: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  cta: { alignSelf: "stretch" },
});
