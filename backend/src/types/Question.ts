export class Question {
    id: number;
    category?: string;
    answers: string[];
    imageUrl?: string;

    constructor(id: number, answers: string[], category?: string, imageUrl?: string) {
        this.id = id;
        this.answers = answers;
        this.category = category;
        this.imageUrl = imageUrl;
    }
}