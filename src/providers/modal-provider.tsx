"use client";

// React, Next.js
import { createContext, useContext, useRef, useState } from "react";

// Prisma models
import { User } from "@prisma/client";

interface ModalProviderProps {
	children: React.ReactNode;
}

export type ModalData = {
	user?: User;
	rowData?: unknown;
};
type ModalContextType = {
	data: ModalData;
	isOpen: boolean;
	setOpen: (
		modal: React.ReactNode,
		fetchData?: () => Promise<Partial<ModalData>>
	) => void;
	setClose: () => void;
};

export const ModalContext = createContext<ModalContextType | null>(null);

const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [data, setData] = useState<ModalData>({});
	const [showingModal, setShowingModal] = useState<React.ReactNode>(null);
	// fetchData の世代 ID。setOpen / setClose のたびに increment し、
	// await 後に世代が進んでいたら setData をスキップする (stale fetch ガード)。
	const requestIdRef = useRef(0);

	// 同期関数として保つことで onClick={() => setOpen(...)} の floating promise を防ぐ。
	// React 19 strict act mode が cleanup 段階で unflushed effect として検出するのを回避するため。
	// fetchData がある場合のみ fire-and-forget の IIFE で非同期処理を起動する。
	const setOpen = (
		modal: React.ReactNode,
		fetchData?: () => Promise<Partial<ModalData>>
	): void => {
		if (!modal) return;
		setShowingModal(modal);
		setIsOpen(true);
		if (!fetchData) return;

		const generation = ++requestIdRef.current;
		void (async () => {
			try {
				const fetchedData = await fetchData();
				if (generation !== requestIdRef.current) return;
				setData((prev) => ({ ...prev, ...fetchedData }));
			} catch (error) {
				if (error instanceof Error) {
					console.error("Failed to fetch modal data:", error.message, error.stack);
				} else {
					console.error("Failed to fetch modal data:", error);
				}
			}
		})();
	};

	const setClose = () => {
		requestIdRef.current++;
		setIsOpen(false);
		setData({});
		setShowingModal(null);
	};

	return (
		<ModalContext.Provider value={{ data, setOpen, setClose, isOpen }}>
			{children}
			{showingModal}
		</ModalContext.Provider>
	);
};

export const useModal = () => {
	const context = useContext(ModalContext);
	if (!context) {
		throw new Error("useModal must be used within the modal provider");
	}
	return context;
};

export default ModalProvider;
