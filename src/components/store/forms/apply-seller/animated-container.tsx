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
    return (
        <motion.div
            variants={reduced ? undefined : poppingTransition}
            initial={reduced ? false : "hidden"}
            animate="visible"
            exit="exit"
            className={styles.step}
        >
            <div className="flex flex-col">{children}</div>
        </motion.div>
    );
}
