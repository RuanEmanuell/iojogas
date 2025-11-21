export class Question {
    id: number;
    category?: string;
    answer: string;
    imageUrl?: string;

    constructor(id: number, answer: string, category?: string, imageUrl?: string) {
        this.id = id;
        this.answer = answer;
        this.category = category;
        this.imageUrl = imageUrl;
    }
}