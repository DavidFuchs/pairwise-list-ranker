import { StyleSheet, Text, View } from "react-native";

import { ListOptionRow } from "@/components/data/ListOptionRow";
import type { ArrayCandidate } from "@/lib/import/arrayCandidates";
import type { CoverageReading } from "@/lib/state/selectors";
import { colors, fonts, space } from "@/lib/theme";

export interface ArrayPickerProps {
  candidates: ArrayCandidate[];
  value: string[] | null;
  onChange: (path: string[]) => void;
  /** Path key ("a.b", joined with ".") to ranking coverage for every
   *  candidate that already has progress behind it - each list in the
   *  document keeps its own, so more than one can show a meter. */
  rankedCoverages?: Record<string, CoverageReading>;
  /** Path key to the setup that list would be ranked with, e.g.
   *  "shown by title · already ranked". See selectListConfig. */
  configLines?: Record<string, string>;
}

/**
 * Only asked when the document holds more than one rankable list. A single
 * candidate is chosen for the user, so the common case shows no control.
 */
export function ArrayPicker({
  candidates,
  value,
  onChange,
  rankedCoverages = {},
  configLines = {},
}: ArrayPickerProps) {
  if (candidates.length < 2) return null;

  const selectedKey = value === null ? null : value.join(".");

  return (
    <View
      style={styles.group}
      role="radiogroup"
      aria-label="Which list to rank"
    >
      <Text style={styles.heading}>Rank which list?</Text>

      {candidates.map((candidate) => {
        const key = candidate.path.join(".");

        return (
          <ListOptionRow
            key={key}
            candidate={candidate}
            selected={key === selectedKey}
            coverage={rankedCoverages[key]}
            configLine={configLines[key]}
            onPress={() => onChange(candidate.path)}
          />
        );
      })}

      <Text style={styles.hint}>
        You can rank each list separately and switch between them anytime - on
        the ranking screen, click the list name in the top-left corner. Nothing
        is lost when you switch.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
