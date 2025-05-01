// Prisma model
import { Category } from "@/generated/prisma";
import { FC } from "react";


interface CategoryDetailsProps {
    data?: Category
}

const CategoryDetails: FC<CategoryDetailsProps> = ({ data }) => { 
    return <div className=""></div>
}

export default CategoryDetails;