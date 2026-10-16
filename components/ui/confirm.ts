import { Alert } from "react-native";
import { haptic } from "./haptics";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + warning haptic. Defaults to true. */
  destructive?: boolean;
}

/** Native confirm dialog as a promise — the only place raw Alert is used. */
export const confirm = ({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
}: ConfirmOptions): Promise<boolean> =>
  new Promise((resolve) => {
    if (destructive) haptic("warning");
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

/** "Discard changes?" guard for dirty forms. */
export const confirmDiscard = () =>
  confirm({
    title: "Discard changes?",
    message: "Your changes haven't been saved.",
    confirmLabel: "Discard",
    cancelLabel: "Keep editing",
  });
