import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity({ name: "otp_verifications" })
export class OtpVerification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar" })
  otp!: string;

  @Column({ type: "datetime" })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
