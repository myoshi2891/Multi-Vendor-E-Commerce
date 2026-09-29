import { MapPin } from "lucide-react";
import { FC } from "react";
import styles from '../product.module.css'

interface Props {
	countryName: string;
	countryCode: string;
	city: string | undefined;
}

const ShipTo: FC<Props> = ({ countryName, countryCode, city }) => {
	return (
        <div className={styles.shipTo}>
            <span>Ship to</span>
            <strong><MapPin size={14} aria-hidden="true" />{[countryName, city, countryCode].filter(Boolean).join(', ')}</strong>
        </div>
	);
};

export default ShipTo;
