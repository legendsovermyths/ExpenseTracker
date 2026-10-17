import { createContext, useContext } from "react";

/**
 * How the current screen was presented. Forms read this to show "Cancel"
 * (modal sheet) or a back chevron (pushed full screen).
 */
export type Presentation = "modal" | "push";

export const PresentationContext = createContext<Presentation>("modal");

export const usePresentation = () => useContext(PresentationContext);
