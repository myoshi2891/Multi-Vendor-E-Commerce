import { Color } from "@prisma/client";

type ColorWheelProps = {
	colors: Partial<Color>[];
	size: number; // Size of the circle in pixels
};

const ColorWheel: React.FC<ColorWheelProps> = ({ colors, size }) => {
	const numColors = colors.length;
	const radius = size / 2; // Calculate the radius based on the size
	const sliceAngle = 360 / numColors; // Calculate the angle for each slice of the wheel

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			className="shadow-sm rounded-full"
		>
			{colors.map((color, index) => {
				const startAngle = index * sliceAngle;
				const endAngle = startAngle + sliceAngle;

				// Convert angles to radians for calculations
				const startRadians = (startAngle * Math.PI) / 180;
				const endRadians = (endAngle * Math.PI) / 180;

				// Calculate start and end points for each slice
				const x1 = radius + radius * Math.cos(startRadians);
				const y1 = radius + radius * Math.sin(startRadians);
				const x2 = radius + radius * Math.cos(endRadians);
				const y2 = radius + radius * Math.sin(endRadians);

				// Create the arc path for the slice
				const largeArcFlag = sliceAngle > 180 ? 1 : 0;

				const pathData = `
          M ${radius},${radius}
          L ${x1},${y1}
          A ${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2}
          Z
        `;

				return (
					<path
						key={index}
						d={pathData}
						fill={color.name}
						stroke="white"
						strokeWidth="1"
					/>
				);
			})}
		</svg>
	);
};

export default ColorWheel;
