/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import ReviewsSort from './sort'

describe('ReviewsSort', () => {
    it('offers an accessible sort selector', () => {
        const setSort = jest.fn()
        render(<ReviewsSort sort={undefined} setSort={setSort} />)
        fireEvent.change(screen.getByRole('combobox', { name: 'Sort reviews' }), { target: { value: 'latest' } })
        expect(setSort).toHaveBeenCalledWith({ orderBy: 'latest' })
    })
})
