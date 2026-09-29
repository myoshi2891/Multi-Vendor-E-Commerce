import { MessageCircleMore, MessageCircleQuestion } from 'lucide-react'
import { FC } from 'react'
import styles from './product.module.css'

interface Question {
    question: string
    answer: string
}

interface Props {
    questions: Question[]
}

const ProductQuestions: FC<Props> = ({ questions }) => {
    return (
        <section className={styles.questionsSection}>
            <div className={styles.contentHeading}><div><p>GOOD TO KNOW</p><h2>Questions &amp; Answers ({questions.length})</h2></div></div>
            <div>
                <ul className={styles.questionList}>
                    {questions.map((question, index) => (
                        <li key={index}>
                            <div><MessageCircleQuestion size={17} aria-hidden="true" /><h3>{question.question}</h3></div>
                            <div><MessageCircleMore size={17} aria-hidden="true" /><p>{question.answer}</p></div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}

export default ProductQuestions
