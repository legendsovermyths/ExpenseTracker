import React from "react";
import { StyleSheet, View } from "react-native";
import { SPACE } from "../../constants";
import GlyphPlate from "../primitives/GlyphPlate";
import Text, { Tone } from "./Text";
import Amount from "./Amount";

export interface DetailHeroProps {
  /** Glyph plate, or pass `leading` for an Avatar etc. */
  icon?: string;
  iconType?: string;
  iconColor?: string;
  leading?: React.ReactNode;
  title: string;
  /** Meta line under the title: date · category · group… */
  meta?: string;
  /** Small label above the amount ("You lent", "Total"…). */
  label?: string;
  amountCents?: number | null;
  amountTone?: Tone;
  /** Line under the amount. */
  caption?: string;
}

/** Centered hero for detail pages: glyph, title, meta, headline amount. */
const DetailHero: React.FC<DetailHeroProps> = ({
  icon,
  iconType = "material-community",
  iconColor,
  leading,
  title,
  meta,
  label,
  amountCents,
  amountTone = "ink",
  caption,
}) => (
  <View style={styles.wrap}>
    {leading ??
      (icon ? (
        <GlyphPlate
          name={icon}
          type={iconType}
          color={iconColor ?? "#888"}
          size={64}
          radius={20}
        />
      ) : null)}
    <Text variant="largeTitle" align="center" style={styles.title}>
      {title}
    </Text>
    {!!meta && (
      <Text variant="callout" tone="muted" align="center" style={styles.meta}>
        {meta}
      </Text>
    )}
    {(label || amountCents != null) && (
      <View style={styles.amountBlock}>
        {!!label && (
          <Text variant="body" tone="muted" align="center">
            {label}
          </Text>
        )}
        {amountCents != null && (
          <Amount
            cents={amountCents}
            variant="display"
            tone={amountTone}
            animated
            from={0}
            style={styles.amount}
          />
        )}
        {!!caption && (
          <Text
            variant="callout"
            tone="subtle"
            align="center"
            style={styles.caption}
          >
            {caption}
          </Text>
        )}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: SPACE.sm, paddingBottom: SPACE.xl },
  title: { marginTop: SPACE.md },
  meta: { marginTop: SPACE.xs },
  amountBlock: { alignItems: "center", marginTop: SPACE.xl },
  amount: { marginTop: SPACE.xs, textAlign: "center" },
  caption: { marginTop: SPACE.xs },
});

export default DetailHero;
