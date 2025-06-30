import { OrderFullType } from "@/lib/types";
import {
    Page,
    StyleSheet,
    Document,
    Text,
    pdf,
    View,
} from "@react-pdf/renderer";

export const generateOrderPDFBlob = async (
    order: OrderFullType
): Promise<Blob> => {
    if (!order) throw new Error("Order is required to generate the PDF.");

    // Define the pdf styles
    const styles = StyleSheet.create({
        page: {
            padding: 30,
            backgroundColor: "#fff",
            fontSize: 12,
        },
        section: {
            marginBottom: 10,
        },
        header: {
            fontSize: 18,
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: 10,
        },
        groupHeader: {
            fontSize: 14,
            fontWeight: "bold",
            marginBottom: 5,
        },
        table: {
            width: "auto",
            borderStyle: "solid",
            borderWidth: 1,
            marginBottom: 20,
            borderColor: "#e4e4e4",
        },
        tableRow: {
            flexDirection: "row",
        },
        tableCell: {
            flexGrow: 1,
            padding: 5,
            borderColor: "#e4e4e4",
            borderWidth: 1,
            overflow: "hidden", // Ensures content doesn't spill over
        },
        productName: {
            maxWidth: "100%", // Ensures it doesn't overflow the table cell
            flexGrow: 2,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden", // Truncate the text if it's too long
        },
    });

    // Define the PDF Document
    const OrderInvoicePdf = (): JSX.Element => (
        <Document>
            <Page style={styles.page}>
                <Text style={styles.header}>Order Invoice</Text>
                {/* Order Summary */}
                <View style={styles.section}>
                    <Text>Order ID: {order.id}</Text>
                    <Text>
                        Order Date:{" "}
                        {new Date(order.createdAt).toLocaleDateString()}
                    </Text>
                    <Text>Order Status: {order.orderStatus}</Text>
                    <Text>Payment Status: {order.paymentStatus}</Text>
                </View>
                {/* Shipping Address */}
                <View style={styles.section}>
                    <Text style={{ fontWeight: "bold", marginBottom: 5 }}>
                        Shipping Address
                    </Text>
                    <Text>
                        {order.shippingAddress.firstName}{" "}
                        {order.shippingAddress.lastName}
                    </Text>
                    <Text>{order.shippingAddress.phone}</Text>
                    <Text>{order.shippingAddress.address1}</Text>
                    {order.shippingAddress.address2 || ""}
                    <Text>
                        {order.shippingAddress.city},
                        {order.shippingAddress.state},
                        {order.shippingAddress.zip_code},
                    </Text>
                    <Text>{order.shippingAddress.country.name}</Text>
                </View>
                {/* Order Groups */}
                {order.groups.map((group, groupIndex) => (
                    <View key={group.id} style={styles.section}>
                        <Text style={styles.groupHeader}>
                            Group {groupIndex + 1}
                        </Text>
                        <Text>Store: {group.store.name}</Text>
                        <Text>Coupon Used: {group.coupon?.code || "None"}</Text>
                        <Text>
                            Shipping Fees: {group.shippingFees.toFixed(2)}
                        </Text>
                        <Text>Group Subtotal: {group.subtotal.toFixed(2)}</Text>
                        <Text>Group Total: {group.total.toFixed(2)}</Text>
                        <Text>Items Count: {group._count.items}</Text>

                        {/* Items Table */}
                        <View style={styles.table}>
                            <View style={styles.tableRow}>
                                <Text
                                    style={[
                                        styles.tableCell,
                                        styles.productName,
                                    ]}
                                >
                                    Item
                                </Text>
                                <Text style={styles.tableCell}>Quantity</Text>
                                <Text style={styles.tableCell}>Price</Text>
                                <Text style={styles.tableCell}>Total</Text>
                            </View>
                            {group.items.map((item) => (
                                <View key={item.id} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, styles.productName]}>
                                        {item.name}
                                    </Text>
                                    <Text style={styles.tableCell}>
                                        {item.quantity}
                                    </Text>
                                    <Text style={styles.tableCell}>
                                        ${item.price.toFixed(2)}
                                    </Text>
                                    <Text style={styles.tableCell}>
                                        ${item.totalPrice.toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
                {/* Order Totals */}
                <View>
                    <Text>Order Subtotal: ${order.subTotal.toFixed(2)}</Text>
                    <Text>Order Shipping Fees: ${order.shippingFees.toFixed(2)}</Text>
                    <Text>Order Total: ${order.total.toFixed(2)}</Text>
                </View>
            </Page>
        </Document>
    );

    // Convert the PDF document to a Blob
    const pdfBlob = await pdf(<OrderInvoicePdf />).toBlob();
    return pdfBlob;
};
