import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class AIAnalysis {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  analysisId: string;

  @Column("jsonb")
  results: any;
}
