"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import React, { useRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const CharacterV1 = ({
  char,
  index,
  centerIndex,
  scrollYProgress,
}) => {
  const isSpace = char === " ";
  const distanceFromCenter = index - centerIndex;

  const x = useTransform(
    scrollYProgress,
    [0, 1],
    [distanceFromCenter * 50, 0],
  );
  const rotateX = useTransform(
    scrollYProgress,
    [0, 1],
    [distanceFromCenter * 50, 0],
  );
  const opacity = useTransform(
    scrollYProgress,
    [0, 1],
    [0, 1],
  );

  return (
    <motion.span
      className={cn("inline-block", isSpace && "w-4")}
      style={{
        x,
        rotateX,
        opacity
      }}
    >
      {char}
    </motion.span>
  );
};

export const AnimatedTitle = ({ text, className }) => {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start 90%", "center center"]
  });

  const characters = text.split("");
  const centerIndex = Math.floor(characters.length / 2);

  const words = text.split(" ");
  let charCount = 0;

  return (
    <div ref={targetRef} className={cn("flex justify-center flex-wrap gap-x-3", className)} style={{ perspective: "500px" }}>
      {words.map((word, wordIndex) => {
        const wordChars = word.split("");
        const wordSpan = (
          <span key={wordIndex} className="whitespace-nowrap flex">
            {wordChars.map((char, i) => {
              const currentIndex = charCount++;
              return (
                <CharacterV1
                  key={i}
                  char={char}
                  index={currentIndex}
                  centerIndex={centerIndex}
                  scrollYProgress={scrollYProgress}
                />
              );
            })}
          </span>
        );
        charCount++;
        return wordSpan;
      })}
    </div>
  );
};

export const AnimatedBox = ({ children, index, centerIndex, scrollYProgress }) => {
  const distanceFromCenter = index - centerIndex;
  
  const x = useTransform(scrollYProgress, [0, 1], [distanceFromCenter * 50, 0]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [distanceFromCenter * 50, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  
  return (
    <motion.div style={{ x, rotateX, opacity, height: "100%" }}>
      {children}
    </motion.div>
  );
};
