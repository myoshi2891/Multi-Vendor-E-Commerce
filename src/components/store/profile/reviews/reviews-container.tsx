"use client";
import {
    ReviewDateFilter,
    ReviewFilter,
    ReviewWithImageType
} from "@/lib/types";
import { getUserReviews } from "@/queries/profile";
import { useEffect, useState, useRef } from "react";
import ReviewCard from "../../cards/review";
import Pagination from "../../shared/pagination";
import ReviewsHeader from "./reviews-header";

export default function ReviewsContainer({
    reviews,
    totalPages,
}: {
    reviews: ReviewWithImageType[];
    totalPages: number;
}) {
    const [data, setData] = useState<ReviewWithImageType[]>(reviews);
    const requestIdRef = useRef(0);
    // Pagination
    const [page, setPage] = useState<number>(1);
    const [totalDataPages, setTotalDataPages] = useState<number>(totalPages);

    // Filter
    const [filter, setFilter] = useState<ReviewFilter>("");

    // Date period filter
    const [period, setPeriod] = useState<ReviewDateFilter>("");

    // Search filter
    const [search, setSearch] = useState<string>("");

    // Handlers to reset page when filters change
    const handleFilterChange: React.Dispatch<
        React.SetStateAction<ReviewFilter>
    > = (value) => {
        setFilter(value);
        setPage(1);
    };

    const handlePeriodChange: React.Dispatch<
        React.SetStateAction<ReviewDateFilter>
    > = (value) => {
        setPeriod(value);
        setPage(1);
    };

    const handleSearchChange: React.Dispatch<
        React.SetStateAction<string>
    > = (value) => {
        setSearch(value);
        setPage(1);
    };

    useEffect(() => {
        let active = true;
        requestIdRef.current += 1;
        const currentRequestId = requestIdRef.current;
        const getData = async () => {
            try {
                const res = await getUserReviews(filter, period, search, page);
                if (res && active && currentRequestId === requestIdRef.current) {
                    setData(res.reviews);
                    setTotalDataPages(res.totalPages);
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[ReviewsContainer:getData] Error fetching reviews:",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        "[ReviewsContainer:getData] Unknown error:",
                        error
                    );
                }
            }
        };
        getData();
        return () => {
            active = false;
        };
    }, [page, filter, search, period]);
    return (
        <div>
            <div className="">
                {/* Header */}
                <ReviewsHeader
                    filter={filter}
                    setFilter={handleFilterChange}
                    period={period}
                    setPeriod={handlePeriodChange}
                    search={search}
                    setSearch={handleSearchChange}
                />
                {/* Table */}
                <div className="space-y-2">
                    {data.map((review) => (
                        <ReviewCard key={review.id} review={review} />
                    ))}
                </div>
            </div>
            <div className="mt-2">
                <Pagination
                    page={page}
                    setPage={setPage}
                    totalPages={totalDataPages}
                />
            </div>
        </div>
    );
}
