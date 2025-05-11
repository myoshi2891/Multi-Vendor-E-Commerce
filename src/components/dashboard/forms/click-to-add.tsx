// React, Next.js
import React, { FC, useState } from "react";
// UI components
import { Input } from "@/components/ui/input";
// Icons
import { PaintBucket } from "lucide-react";
// Color picker
import { SketchPicker } from "react-color";

// Define the interface for each detail object
export interface Detail {
	[key: string]: string | number | undefined;
}

// Define the interface for the ClickToAddInputs component
interface ClickToAddInputsProps {
	details: Detail[]; // Array of detail objects1
	setDetails: React.Dispatch<React.SetStateAction<Detail[]>>; // Setter function for detail objects
	initialDetail?: Detail; // Optional initial detail objects
	header: string; // Header for the component
	colorPicker?: boolean; // if color picker is needed
}

// ClickToAddInputs component definition
const ClickToAddInputs: FC<ClickToAddInputsProps> = ({
	details,
	setDetails,
	initialDetail = {}, // Default value for initial detail is an empty object
	header,
	colorPicker,
}) => {
	// State to manage toggling color picker
	const [colorPickerIndex, setColorPickerIndex] = useState<number | null>(
		null
	);

	// Function to handle changes in detail properties
	const handleDetailsChange = (
		index: number,
		property: string,
		value: string | number
	) => {
		// Update the details array with the new property value
		const updatedDetails = details.map((detail, i) =>
			i === index ? { ...detail, [property]: value } : detail
		);

		setDetails(updatedDetails);
	};

	// Function to add a new detail object
	const handleAddDetail = () => {
		// Add a new detail object to the details array
		setDetails([
			...details,
			{
				...initialDetail, //Spread the initial detail object to create a new one
			},
		]);
	};

	// Function to remove a detail object
	const handleRemove = (index: number) => {
		// We must at least keep one detail we can delete if it's the only detail available
		if (details.length === 1) return;
		if (details.length > 1) {
			// Remove the detail object at the specified index
			// setDetails(details.filter((_, i) => i !== index));
			const updatedDetails = details.filter((_, i) => i !== index);
			setDetails(updatedDetails); // Update the state with the filtered details
		}
	};

	// PlusButton component for adding new detail objects
	const PlusButton = ({ onClick }: { onClick: () => void }) => {
		return (
			<button
				onClick={onClick}
				type="button"
				title="Add nre detail"
				className="group cursor-pointer outline-none hover:rotate-90 duration-300"
			>
				{/* Plus icon */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="50px"
					height="50px"
					viewBox="0 0 24 24"
					className="w-8 h-8 stroke-blue-400 fill-none group-hover:fill-blue-primary group-active:stroke-blue-200 group-active:fill-blue-700 group-active:duration-0 duration-300"
				>
					<path
						d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"
						strokeWidth="1.5"
					/>
					<path d="M8 12H16" strokeWidth="1.5" />
					<path d="M12 16V8" strokeWidth="1.5" />
				</svg>
			</button>
		);
	};

	// MinusButton component for removing details
	const MinusButton = ({ onClick }: { onClick: () => void }) => {
		return (
			<button
				type="button"
				title="Remove detail"
				className="group cursor-pointer outline-none hover:rotate-90 duration-300"
				onClick={onClick}
			>
				{/* Minus icon */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="50px"
					height="50px"
					viewBox="0 0 24 24"
					className="w-8 h-8 stroke-blue-400 fill-none group-hover:fill-white group-active:stroke-blue-200 group-active:fill-blue-700 group-active:duration-0 duration-300"
				>
					<path
						d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"
						strokeWidth="1.5"
					/>
					<path d="M8 12H16" strokeWidth="1.5" />
				</svg>
			</button>
		);
	};

	return (
		<div className="flex flex-col gap-y-4">
			{/* Header */}
			<div>{header}</div>
			{/* Display PlusButton if no details exist */}
			{details?.length === 0 && <PlusButton onClick={handleAddDetail} />}
			{/* Map through details and render input fields */}
			{details?.map((detail, index) => (
				<div key={index} className="flex items-center gap-x-4">
					{Object.keys(detail).map((property, propIndex) => (
						<div
							key={propIndex}
							className="flex items-center gap-x-4"
						>
							{/* Color picker toggle */}
							{property === "color" && colorPicker && (
								<div className="flex gap-x-4">
									<button
										type="button"
										className="cursor-pointer"
										onClick={() =>
											setColorPickerIndex(
												colorPickerIndex === index
													? null
													: index
											)
										}
									>
										<PaintBucket />
									</button>
									<span
										className="w-8 h-8 rounded-full"
										style={{
											backgroundColor: detail[
												property
											] as string,
										}}
									/>
								</div>
							)}

							{/* Color Picker */}
							{colorPickerIndex === index &&
								property === "color" && (
									<SketchPicker
										color={detail[property] as string}
										onChange={(e) =>
											handleDetailsChange(
												index,
												property,
												e.hex
											)
										}
									/>
								)}

							{/* Input field for each property */}
							<Input
								className="w-28"
								type={
									typeof detail[property] === "number"
										? "number"
										: "text"
								}
								name={property}
								placeholder={property}
								value={detail[property] as string}
								min={
									typeof detail[property] === "number"
										? 0
										: undefined
								}
								step="0.01"
								onChange={(e) =>
									handleDetailsChange(
										index,
										property,
										e.target.type === "number"
											? parseFloat(e.target.value)
											: e.target.value
									)
								}
							/>
						</div>
					))}
					{/* Show buttons for each row of inputs */}
					<MinusButton onClick={() => handleRemove(index)} />
					<PlusButton onClick={handleAddDetail} />
				</div>
			))}
		</div>
	);
};

export default ClickToAddInputs;
