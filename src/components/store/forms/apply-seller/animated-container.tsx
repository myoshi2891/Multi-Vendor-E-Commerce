import styles from "./application.module.css";
import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { poppingTransition } from "./transition";

export default function AnimatedContainer({
    children,
}: {
    children: ReactNode;
}) {
    const reduced = useReducedMotion();
    // Start visible on both server and client; media preferences must not change hydration styles.
    const variants = reduced
        ? {
              visible: { opacity: 1, scale: 1, transition: { duration: 0 } },
              exit: { opacity: 1, scale: 1, transition: { duration: 0 } },
          }
        : poppingTransition;
    return (
        <motion.div
            variants={variants}
            initial={false}
            animate="visible"
            exit="exit"
            className={styles.step}
        >
            <div className="flex flex-col">{children}</div>
        </motion.div>
    );
}
