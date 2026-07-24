import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class AITrigger {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  target: string;

  @Column()
  event: string;
}
