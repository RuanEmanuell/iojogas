export class Player {
    name  : string;
    id    : string;
    score : number;
    leader: boolean;

    constructor(name: string, id: string, score: number, leader: boolean)  {
        this.name   = name;
        this.id     = id;
        this.score  = score;
        this.leader = leader;
    }
}