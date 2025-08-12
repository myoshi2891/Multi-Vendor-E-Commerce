import { ReactNode } from "react";
import { motion } from "framer-motion";
import { poppingTransition } from "./transition";

export default function AnimatedContainer({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <motion.div
            variants={poppingTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="h-[calc(100vh-200px)]"
        >
            <div className="flex h-full flex-col overflow-y-auto px-2 pt-4">
                {children}
            </div>
        </motion.div>
    );
}
