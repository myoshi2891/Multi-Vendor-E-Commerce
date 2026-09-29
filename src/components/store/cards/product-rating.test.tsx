/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import RatingCard from './product-rating'

jest.mock('react-rating-stars-component', () => () => null)

describe('RatingCard', () => {
    it.each([
        [5, '5.00'],
        [4.276, '4.28'],
        [0, '0.00'],
    ])('shows rating %s with two decimal places', (rating, expected) => {
        render(<RatingCard rating={rating} editorial />)
        expect(screen.getByText(expected)).toBeInTheDocument()
    })
})
