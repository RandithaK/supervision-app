import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity({ name: "supervision_assignments" })
export class SupervisionAssignment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  supervisorId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "supervisorId" })
  supervisor!: User;

  @Column({ type: "varchar" })
  superviseeId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "superviseeId" })
  supervisee!: User;

  @CreateDateColumn()
  createdAt!: Date;
}
