export function bindAssessmentSecurity({
  submittedRef,
  onTabSwitch,
  onBlockedAction,
  onAutoSubmit,
  blockContextMenu = true,
}) {
  const warnBlockedAction = () => {
    if (typeof onBlockedAction === "function") {
      onBlockedAction(
        "Copy, paste, cut, select-all, and right-click are disabled during this assessment."
      );
    }
  };

  const handleVisibility = () => {
    if (document.hidden && !submittedRef.current && typeof onTabSwitch === "function") {
      onTabSwitch();
    }
  };

  const handleContextMenu = (event) => {
    if (!blockContextMenu) return;
    event.preventDefault();
    warnBlockedAction();
  };

  const handleClipboard = (event) => {
    event.preventDefault();
    warnBlockedAction();
  };

  const handleKeyDown = (event) => {
    const key = (event.key || "").toLowerCase();
    const withModifier = event.ctrlKey || event.metaKey;
    const blockedKeys = new Set(["c", "v", "x", "a"]);

    if (withModifier && blockedKeys.has(key)) {
      event.preventDefault();
      warnBlockedAction();
      return;
    }

    if (key === "printscreen") {
      event.preventDefault();
      warnBlockedAction();
      if (typeof onAutoSubmit === "function" && !submittedRef.current) {
        onAutoSubmit();
      }
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);
  document.addEventListener("contextmenu", handleContextMenu);
  document.addEventListener("copy", handleClipboard);
  document.addEventListener("cut", handleClipboard);
  document.addEventListener("paste", handleClipboard);
  document.addEventListener("keydown", handleKeyDown);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    document.removeEventListener("contextmenu", handleContextMenu);
    document.removeEventListener("copy", handleClipboard);
    document.removeEventListener("cut", handleClipboard);
    document.removeEventListener("paste", handleClipboard);
    document.removeEventListener("keydown", handleKeyDown);
  };
}
