"use client";

// React, Next.js
import { createContext, useContext, useEffect, useState } from "react";

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
	) => Promise<void>;
	setClose: () => void;
};

export const ModalContext = createContext<ModalContextType | null>(null);

const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [data, setData] = useState<ModalData>({});
	const [showingModal, setShowingModal] = useState<React.ReactNode>(null);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const setOpen = async (
		modal: React.ReactNode,
		fetchData?: () => Promise<Partial<ModalData>>
	) => {
		if (modal) {
			if (fetchData) {
				try {
					const fetchedData = await fetchData();
					setData((prev) => ({ ...prev, ...fetchedData }));
				} catch (error) {
					console.error("Failed to fetch modal data:", error);
					// Set to safe empty state or keep previous but log error
					setData((prev) => prev);
				}
			}
			setShowingModal(modal);
			setIsOpen(true);
		}
	};

	const setClose = () => {
		setIsOpen(false);
		setData({});
		setShowingModal(null);
	};

	if (!isMounted) return null;

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
