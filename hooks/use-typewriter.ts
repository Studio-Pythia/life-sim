"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTypewriterOptions {
  speed?: number;
  pauseOnPunctuation?: boolean;
  onComplete?: () => void;
}

export function useTypewriter(
  text: string,
  options: UseTypewriterOptions = {}
) {
  const { speed = 30, pauseOnPunctuation = true, onComplete } = options;
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    indexRef.current = 0;
    setDisplayedText("");
    setIsComplete(false);
  }, []);

  const skipToEnd = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDisplayedText(text);
    setIsComplete(true);
    onComplete?.();
  }, [text, onComplete]);

  useEffect(() => {
    reset();

    if (!text) {
      setIsComplete(true);
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
        setIsComplete(true);
        onComplete?.();
      }
    };

    timeoutRef.current = setTimeout(typeNextChar, speed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, pauseOnPunctuation, onComplete, reset]);

  return {
    displayedText,
    isComplete,
    reset,
    skipToEnd,
  };
}
