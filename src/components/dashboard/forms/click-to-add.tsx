import { Input } from "@/components/ui/input";
import { FC } from "react";

// Define the interface for each detail object
export interface Detail {
	[key: string]: string | number | boolean | undefined;
}

// Define the interface for the ClickToAddInputs component
interface ClickToAddInputsProps {
	details: Detail[]; // Array of detail objects1
	setDetails: React.Dispatch<React.SetStateAction<Detail[]>>; // Setter function for detail objects
	initialDetail?: Detail; // Optional initial detail objects
	header: string; // Header for the component
}

// ClickToAddInputs component definition
const ClickToAddInputs: FC<ClickToAddInputsProps> = ({
	details,
	setDetails,
	initialDetail = {}, // Default value for initial detail is an empty object
	header,
}) => {
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
			{details.length === 0 && <PlusButton onClick={() => {}} />}
			{/* Map through details and render input fields */}
			{details.map((detail, index) => (
				<div key={index} className="flex items-center gap-x-4">
					{Object.keys(detail).map((property, propIndex) => (
						<div
							key={propIndex}
							className="flex items-center gap-x-4"
						>
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
							/>
						</div>
                    ))}
                    {/* Show buttons for each row of inputs */}
                    <MinusButton onClick={() => {}} />
                    <PlusButton  onClick={() => {}}/>
				</div>
			))}
		</div>
	);
};

export default ClickToAddInputs;
