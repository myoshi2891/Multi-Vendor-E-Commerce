import { useCartStore } from "@/cart-store/useCartStore";
import { CartProductType } from "@/lib/types";
import styles from "./cart.module.css";
import { Dispatch, FC, SetStateAction } from "react";

interface Props {
    cartItems: CartProductType[];
    selectedItems: CartProductType[];
    setSelectedItems: Dispatch<SetStateAction<CartProductType[]>>;
}
const CartHeader: FC<Props> = ({
    cartItems,
    selectedItems,
    setSelectedItems,
}) => {
    const removeMultipleFromCart = useCartStore(
        (state) => state.removeMultipleFromCart
    );
    const cartLength = cartItems.length;
    const selectedLength = selectedItems.length;

    const handleSelectAll = () => {
        const areAllSelected = cartItems.every((item) =>
            selectedItems.some(
                (selected) =>
                    selected.productId === item.productId &&
                    selected.variantId === item.variantId &&
                    selected.sizeId === item.sizeId
            )
        );
        setSelectedItems(areAllSelected ? [] : cartItems);
    };
    const removeSelectedFromCart = () => {
        removeMultipleFromCart(selectedItems);

        // Remove the selected items from both cart and selectedItems
        setSelectedItems((prevSelectedItems) =>
            prevSelectedItems.filter(
                (selected) =>
                    !cartItems.some(
                        (item) =>
                            selected.productId === item.productId &&
                            selected.variantId === item.variantId &&
                            selected.sizeId === item.sizeId
                    )
            )
        );
    };
    return (
        <div className={styles.header}>
            <h2>Cart ({cartLength})</h2>
            <div className={styles.selection}>
                <label>
                    <input
                        type="checkbox"
                        checked={
                            cartLength > 0 && selectedLength === cartLength
                        }
                        onChange={handleSelectAll}
                    />
                    <span>Select all products</span>
                </label>
                {selectedLength > 0 && (
                    <button
                        type="button"
                        className={styles.textButton}
                        onClick={removeSelectedFromCart}
                    >
                        Delete all selected products
                    </button>
                )}
            </div>
        </div>
    );
};

export default CartHeader;
