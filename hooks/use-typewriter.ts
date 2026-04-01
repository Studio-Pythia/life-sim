"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  instant?: boolean;
  pauseOnPunctuation?: boolean;
}

export function useTypewriter({
  text,
  speed = 30,
  onComplete,
  instant = false,
  pauseOnPunctuation = true,
}: UseTypewriterProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  const reset = useCallback(() => {
    indexRef.current = 0;
    hasCompletedRef.current = false;
    setDisplayedText("");
    setIsComplete(false);
  }, []);

  const skip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (!hasCompletedRef.current) {
      hasCompletedRef.current = true;
      setDisplayedText(text);
      setIsComplete(true);
      onComplete?.();
    }
  }, [text, onComplete]);

  useEffect(() => {
    reset();

    if (!text) {
      setIsComplete(true);
      hasCompletedRef.current = true;
      onComplete?.();
      return;
    }

    // If instant mode, show all text immediately
    if (instant) {
      setDisplayedText(text);
      setIsComplete(true);
      hasCompletedRef.current = true;
      onComplete?.();
      return;
    }

    const typeNextChar = () => {
      if (indexRef.current < text.length) {
        const char = text[indexRef.current];
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;

        // Calculate delay based on character
        let delay = speed;
        if (pauseOnPunctuation) {
          if (char === "." || char === "!" || char === "?") {
            delay = speed * 6;
          } else if (char === "," || char === ";") {
            delay = speed * 3;
          }
        }

        timeoutRef.current = setTimeout(typeNextChar, delay);
      } else {
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          setIsComplete(true);
          onComplete?.();
        }
      }
    };

    timeoutRef.current = setTimeout(typeNextChar, speed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, pauseOnPunctuation, onComplete, instant, reset]);

  return {
    displayedText,
    isComplete,
    skip,
    reset,
  };
}
