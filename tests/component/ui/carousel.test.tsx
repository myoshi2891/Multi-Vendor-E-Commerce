/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

describe("Carousel (snapshot)", () => {
    it("renders 3 slides in initial state", () => {
        const { container } = render(
            <Carousel>
                <CarouselContent>
                    <CarouselItem>Slide 1</CarouselItem>
                    <CarouselItem>Slide 2</CarouselItem>
                    <CarouselItem>Slide 3</CarouselItem>
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
            </Carousel>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
