import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TEXT_FORMATS } from '@/lib/formats';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { TextFormat } from '@/types/list';

export interface WorkspaceControlsProps {
  persistenceAvailable: boolean;
  canExport: boolean;
  savedAt?: string;
  onDownload: (format: TextFormat) => void;
  onReset: () => void;
}

const FORMAT_LABELS: Record<TextFormat, string> = {
  yaml: 'YAML',
  json: 'JSON',
  markdown: 'Markdown',
};

/**
 * The honest account of where the user's data lives, plus the two actions that
 * follow from it: take a copy out, or clear what is held here.
 */
export function WorkspaceControls({
  persistenceAvailable,
  canExport,
  savedAt,
  onDownload,
  onReset,
}: WorkspaceControlsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <Text style={styles.heading}>Workspace</Text>

      <Text style={styles.body}>
        {persistenceAvailable
          ? 'This list is kept in this browser only. Download a file to keep it or move it elsewhere.'
          : 'This browser will not keep your list: it is not saved, and a reload starts over. Download a file to keep your work.'}
      </Text>

      {savedAt !== undefined && (
        <Text style={styles.meta}>{`Last saved ${formatTime(savedAt)}`}</Text>
      )}

      {canExport && (
        <View style={styles.downloads}>
          {TEXT_FORMATS.map((format) => (
            <Button
              key={format}
              label={FORMAT_LABELS[format]}
              accessibilityLabel={`Download ${FORMAT_LABELS[format]}`}
              variant="secondary"
              size="sm"
              onPress={() => onDownload(format)}
              style={styles.downloadButton}
            />
          ))}
        </View>
      )}

      {confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            This clears the list held in this browser. Exported files are not affected.
          </Text>
          <View style={styles.confirmActions}>
            <Button
              label="Cancel"
              accessibilityLabel="Keep the workspace"
              variant="ghost"
              size="sm"
              onPress={() => setConfirming(false)}
            />
            <Button
              label="Clear it"
              accessibilityLabel="Confirm clearing the workspace"
              variant="danger"
              size="sm"
              onPress={() => {
                setConfirming(false);
                onReset();
              }}
            />
          </View>
        </View>
      ) : (
        <Button
          label="Clear workspace"
          accessibilityLabel="Clear this workspace"
          variant="ghost"
          size="sm"
          onPress={() => setConfirming(true)}
        />
      )}
    </View>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  panel: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  meta: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  downloads: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  downloadButton: { flexGrow: 1, flexBasis: 90 },
  confirm: {
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoftBorder,
    backgroundColor: colors.dangerSoft,
  },
  confirmText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.dangerText },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs },
});
