import { Card, Text, Badge, Button, makeStyles, shorthands } from '@fluentui/react-components';
import { Bot24Regular, Delete16Regular } from '@fluentui/react-icons';
import { useAiSignalsStore, type AiSignal } from '../store/aiSignalsStore';

const useStyles = makeStyles({
  card: {
    backgroundColor: 'var(--ct-bg-raised)',
    ...shorthands.border('1px', 'solid', 'var(--ct-border)'),
    ...shorthands.borderRadius('var(--ct-radius-lg)'),
    ...shorthands.padding('16px'),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shorthands.margin('0', '0', '12px', '0'),
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  headerIcon: {
    color: '#A855F7',
  },
  feed: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
  },
  signalRow: {
    ...shorthands.padding('10px', '12px'),
    ...shorthands.borderRadius('var(--ct-radius-md)'),
    backgroundColor: 'var(--ct-bg-elevated)',
    ...shorthands.border('1px', 'solid', 'var(--ct-border)'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px'),
  },
  rowTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shorthands.gap('8px'),
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
  },
  confidenceTrack: {
    height: '3px',
    ...shorthands.borderRadius('2px'),
    backgroundColor: 'var(--ct-bg-deep)',
    ...shorthands.overflow('hidden'),
    marginTop: '2px',
  },
  emptyState: {
    ...shorthands.padding('20px', '0'),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  overflow: {
    textAlign: 'center',
    ...shorthands.padding('6px', '0', '0', '0'),
  },
});

const SIGNAL_COLORS: Record<string, { fg: string; bg: string; bar: string }> = {
  BULLISH: { fg: 'var(--ct-bullish)', bg: 'rgba(34,197,94,0.1)', bar: '#22C55E' },
  BEARISH: { fg: 'var(--ct-bearish)', bg: 'rgba(239,68,68,0.1)', bar: '#EF4444' },
  NEUTRAL: { fg: '#FBBF24', bg: 'rgba(251,191,36,0.1)', bar: '#FBBF24' },
};

const SIGNAL_ICON: Record<string, string> = {
  BULLISH: '↑',
  BEARISH: '↓',
  NEUTRAL: '→',
};

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function SignalRow({ signal }: { signal: AiSignal }) {
  const styles = useStyles();
  const scheme = SIGNAL_COLORS[signal.signal] ?? SIGNAL_COLORS.NEUTRAL;
  const icon = SIGNAL_ICON[signal.signal] ?? '→';

  return (
    <div className={styles.signalRow}>
      <div className={styles.rowTop}>
        <div className={styles.rowMeta}>
          <Text
            size={200}
            weight="semibold"
            style={{ fontFamily: 'var(--ct-font-mono)', color: 'var(--ct-text-primary)', letterSpacing: '0.04em' }}
          >
            {signal.symbol.replace('USDT', '')}
            <span style={{ color: 'var(--ct-text-muted)', fontWeight: 400 }}>/USDT</span>
          </Text>
          <Badge
            appearance="filled"
            size="small"
            shape="rounded"
            style={{
              backgroundColor: scheme.bg,
              color: scheme.fg,
              fontFamily: 'var(--ct-font-mono)',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            {icon} {signal.signal}
          </Badge>
          {signal.side && (
            <Badge
              appearance="outline"
              size="small"
              shape="rounded"
              style={{ fontFamily: 'var(--ct-font-mono)', fontSize: '10px', color: 'var(--ct-text-muted)' }}
            >
              {signal.side}
            </Badge>
          )}
        </div>
        <Text size={100} style={{ color: 'var(--ct-text-muted)', fontFamily: 'var(--ct-font-mono)', whiteSpace: 'nowrap' }}>
          {timeAgo(signal.receivedAt)}
        </Text>
      </div>

      <div>
        <Text size={100} style={{ color: 'var(--ct-text-muted)', fontFamily: 'var(--ct-font-mono)' }}>
          Conf: {(signal.confidence * 100).toFixed(1)}%
        </Text>
        <div className={styles.confidenceTrack}>
          <div
            style={{
              width: `${signal.confidence * 100}%`,
              height: '100%',
              borderRadius: 2,
              backgroundColor: scheme.bar,
              transition: 'width 0.4s ease-out',
            }}
          />
        </div>
      </div>

      <Text
        size={100}
        style={{ color: 'var(--ct-text-secondary)', fontFamily: 'var(--ct-font-sans)', lineHeight: '1.4', fontSize: '11px' }}
      >
        {signal.reason}
      </Text>
    </div>
  );
}

const DISPLAY_LIMIT = 5;

export const AiSignalsFeed = () => {
  const styles = useStyles();
  const { signals, clearSignals } = useAiSignalsStore();
  const visible = signals.slice(0, DISPLAY_LIMIT);
  const overflow = signals.length - DISPLAY_LIMIT;

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Bot24Regular className={styles.headerIcon} />
          <Text size={400} weight="semibold" style={{ fontFamily: 'var(--ct-font-sans)' }}>
            AI Signal Feed
          </Text>
          {signals.length > 0 && (
            <Badge appearance="tint" size="small" shape="circular" color="informative"
              style={{ fontFamily: 'var(--ct-font-mono)', fontSize: '10px' }}>
              {signals.length}
            </Badge>
          )}
        </div>
        {signals.length > 0 && (
          <Button
            appearance="subtle"
            size="small"
            icon={<Delete16Regular />}
            onClick={clearSignals}
            style={{ color: 'var(--ct-text-muted)' }}
          />
        )}
      </div>

      {signals.length === 0 ? (
        <div className={styles.emptyState}>
          <Text size={200} style={{ color: 'var(--ct-text-muted)', fontFamily: 'var(--ct-font-mono)' }}>
            Waiting for market activity...
          </Text>
          <Text size={100} style={{ color: 'var(--ct-text-muted)', fontFamily: 'var(--ct-font-sans)', textAlign: 'center' }}>
            Signals appear here after orders are executed
          </Text>
        </div>
      ) : (
        <div className={styles.feed}>
          {visible.map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))}
          {overflow > 0 && (
            <div className={styles.overflow}>
              <Text size={100} style={{ color: 'var(--ct-text-muted)', fontFamily: 'var(--ct-font-mono)' }}>
                +{overflow} more signal{overflow > 1 ? 's' : ''} in session
              </Text>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
