import { useState } from "react";
import {
  Card,
  Textarea,
  Button,
  Text,
  Badge,
  Spinner,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import { BrainCircuit24Regular } from "@fluentui/react-icons";
import { analysisService } from "../services/analysisService";
import type { SentimentResult } from "../models/SentimentResult";

const useStyles = makeStyles({
  card: {
    backgroundColor: "var(--ct-bg-raised)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    ...shorthands.borderRadius("var(--ct-radius-lg)"),
    ...shorthands.padding("16px"),
  },
  header: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
    ...shorthands.margin("0", "0", "12px", "0"),
  },
  headerIcon: {
    color: "#A855F7",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("12px"),
  },
  resultBox: {
    marginTop: "8px",
    ...shorthands.padding("14px"),
    ...shorthands.borderRadius("var(--ct-radius-md)"),
    backgroundColor: "var(--ct-bg-elevated)",
    ...shorthands.border("1px", "solid", "var(--ct-border)"),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
    animation: "ct-fade-in 0.3s ease-out both",
  },
  resultHeader: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
  },
  confidence: {
    height: "4px",
    ...shorthands.borderRadius("2px"),
    backgroundColor: "var(--ct-bg-deep)",
    marginTop: "4px",
    ...shorthands.overflow("hidden"),
  },
  analyzeBtn: {
    ...shorthands.borderRadius("var(--ct-radius-sm)"),
    fontFamily: "var(--ct-font-sans)",
    fontWeight: "600",
  },
});

export const SentimentWidget = () => {
  const styles = useStyles();
  const [text, setText] = useState("");
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!text.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await analysisService.analyzeText(text);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze sentiment. Is the AI service online?");
    } finally {
      setLoading(false);
    }
  };

  const getBadgeColor = (label: string) => {
    if (label === "POSITIVE") return "success";
    if (label === "NEGATIVE") return "danger";
    return "warning";
  };

  const getBarColor = (label: string) => {
    if (label === "POSITIVE") return "var(--ct-bullish)";
    if (label === "NEGATIVE") return "var(--ct-bearish)";
    return "#FBBF24";
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <BrainCircuit24Regular className={styles.headerIcon} />
        <Text size={400} weight="semibold" style={{ fontFamily: "var(--ct-font-sans)" }}>
          AI Analyst
        </Text>
      </div>

      <div className={styles.body}>
        <Textarea
          value={text}
          onChange={(_, data) => setText(data.value)}
          placeholder="Paste a crypto news headline..."
          rows={3}
          resize="vertical"
          style={{ fontFamily: "var(--ct-font-sans)", fontSize: "13px" }}
        />

        <Button
          appearance="primary"
          onClick={handleAnalyze}
          disabled={loading || !text}
          icon={loading ? <Spinner size="tiny" /> : undefined}
          size="small"
          className={styles.analyzeBtn}
        >
          {loading ? "Analyzing..." : "Analyze Sentiment"}
        </Button>

        {error && (
          <Text style={{ color: "var(--ct-bearish)", fontSize: "13px" }}>
            {error}
          </Text>
        )}

        {result && (
          <div className={styles.resultBox}>
            <div className={styles.resultHeader}>
              <Text weight="semibold" size={300} style={{ fontFamily: "var(--ct-font-sans)" }}>
                Verdict:
              </Text>
              <Badge
                appearance="filled"
                size="medium"
                shape="rounded"
                color={getBadgeColor(result.label)}
                style={{ fontFamily: "var(--ct-font-mono)", fontSize: "11px" }}
              >
                {result.label}
              </Badge>
            </div>

            <div>
              <Text size={200} style={{ color: "var(--ct-text-secondary)", fontFamily: "var(--ct-font-mono)" }}>
                Confidence: {(result.score * 100).toFixed(1)}%
              </Text>
              <div className={styles.confidence}>
                <div
                  style={{
                    width: `${result.score * 100}%`,
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: getBarColor(result.label),
                    transition: "width 0.5s ease-out",
                  }}
                />
              </div>
            </div>

            <Text size={100} style={{ color: "var(--ct-text-muted)", fontFamily: "var(--ct-font-mono)" }}>
              Model: {result.model_version}
            </Text>
          </div>
        )}
      </div>
    </Card>
  );
};
