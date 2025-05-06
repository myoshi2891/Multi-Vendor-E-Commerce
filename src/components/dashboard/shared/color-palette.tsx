// React
import { Dispatch, SetStateAction } from "react";

// Props definition
interface ColorPaletteProps {
	colors?: { colors: string }[]; // Extracted Colors (Array of strings)
	colorsData?: { colors: string }[]; // List of selected colors from form
	setColors: Dispatch<SetStateAction<{ color: string }[]>>; // Setter function for color objects
}

// ColorPalette component for displaying color palette
const ColorPalette: React.FC<ColorPaletteProps> = ({ colors, colorsData, setColors }) => {
    return <div></div>
 }

export default ColorPalette;