import { cn } from '@/lib/utils'
import { MoveLeft, MoveRight } from 'lucide-react'
import { Dispatch, FC, SetStateAction } from 'react'

interface Props {
    page: number
    totalPages: number
    setPage: Dispatch<SetStateAction<number>>
}

const Pagination: FC<Props> = ({ page, totalPages, setPage }) => {
    const handlePrevious = () => {
        if (page > 1) {
            setPage((prev) => prev - 1)
        }
    }

    const handleNext = () => {
        if (page < totalPages) {
            setPage((prev) => prev + 1)
        }
    }

    return (
        <div className="w-full px-4 py-10 sm:px-6 lg:px-0">
            <div className="flex w-full items-center justify-end gap-x-4 border-t border-gray-200">
                <div
                    onClick={() => handlePrevious()}
                    className="flex cursor-pointer items-center pt-3 text-gray-600 hover:text-orange-background"
                >
                    <MoveLeft className="w-3" />
                    <p className="ml-3 text-sm font-medium leading-none">
                        Previous
                    </p>
                </div>
                <div className="flex flex-wrap">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <span
                            key={i}
                            className={cn(
                                "mr-4 cursor-pointer border-t border-transparent px-2 pt-3 text-sm font-medium leading-none text-gray-600 hover:text-orange-background",
                                {
                                    "border-orange-background text-orange-background":
                                        i + 1 === page,
                                }
                            )}
                            onClick={() => setPage(i + 1)}
                        >
                            {i + 1}
                        </span>
                    ))}
                </div>
                <div
                    onClick={() => handleNext()}
                    className="flex cursor-pointer items-center pt-3 text-gray-600 hover:text-orange-background"
                >
                    <MoveRight className="w-3" />
                    <p className="ml-3 text-sm font-medium leading-none">
                        Next
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Pagination
