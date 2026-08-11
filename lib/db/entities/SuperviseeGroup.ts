import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import type { User } from "./User";
import type { SuperviseeGroupMember } from "./SuperviseeGroupMember";

@Entity({ name: "supervisee_groups" })
export class SuperviseeGroup {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar" })
  createdById!: string;

  @ManyToOne("User", { onDelete: "CASCADE" })
  @JoinColumn({ name: "createdById" })
  createdBy!: User;

  @OneToMany("SuperviseeGroupMember", (member: any) => member.group)
  members!: SuperviseeGroupMember[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
