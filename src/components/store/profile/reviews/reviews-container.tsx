"use client";
import {
    ReviewDateFilter,
    ReviewFilter,
    ReviewWithImageType
} from "@/lib/types";
import { getUserReviews } from "@/queries/profile";
import { useEffect, useState } from "react";
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
    // Pagination
    const [page, setPage] = useState<number>(1);
    const [totalDataPages, setTotalDataPages] = useState<number>(totalPages);

    // Filter
    const [filter, setFilter] = useState<ReviewFilter>("");

    // Date period filter
    const [period, setPeriod] = useState<ReviewDateFilter>("");

    // Search filter
    const [search, setSearch] = useState<string>("");

    // Render-phase state adjustment to reset page
    const [prevFilter, setPrevFilter] = useState<ReviewFilter>(filter);
    const [prevPeriod, setPrevPeriod] = useState<ReviewDateFilter>(period);
    const [prevSearch, setPrevSearch] = useState<string>(search);

    if (filter !== prevFilter || period !== prevPeriod || search !== prevSearch) {
        setPrevFilter(filter);
        setPrevPeriod(period);
        setPrevSearch(search);
        setPage(1);
    }

    useEffect(() => {
        let active = true;
        const getData = async () => {
            try {
                const res = await getUserReviews(filter, period, search, page);
                if (res && active) {
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
                    setFilter={setFilter}
                    period={period}
                    setPeriod={setPeriod}
                    search={search}
                    setSearch={setSearch}
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
