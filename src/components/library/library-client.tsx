"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addLibraryBookAction,
  addLibraryBookTypeAction,
  borrowLibraryBookAction,
  returnLibraryBookAction,
} from "@/actions/library";
import { StudentSearchSelect } from "@/components/students/student-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { daysBorrowed } from "@/lib/academic-sections";
import { formatDate } from "@/lib/format";

type BookType = { id: string; name: string };

type Book = {
  id: string;
  title: string;
  qitab_id: string;
  author: string | null;
  type_id: string | null;
  type_name: string | null;
  copies_total: number;
  available: number;
  notes: string | null;
};

type Student = { id: string; full_name: string; admission_no: string };

type Loan = {
  id: string;
  book_id: string;
  book_title: string;
  book_qitab_id: string;
  book_author: string | null;
  book_type_name: string | null;
  student_id: string;
  student_name: string;
  admission_no: string;
  borrowed_at: string;
  returned_at: string | null;
  notes: string | null;
};

export function LibraryClient({
  vendorId,
  branchId,
  books,
  bookTypes,
  students,
  activeLoans,
  returnedLoans,
  canManage,
}: {
  vendorId: string;
  branchId: string;
  books: Book[];
  bookTypes: BookType[];
  students: Student[];
  activeLoans: Loan[];
  returnedLoans: Loan[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [bookQuery, setBookQuery] = useState("");
  const [tab, setTab] = useState<"active" | "history">("active");
  const [borrowBookId, setBorrowBookId] = useState(books[0]?.id || "");
  const [borrowStudentId, setBorrowStudentId] = useState("");
  const [typeId, setTypeId] = useState(bookTypes[0]?.id || "");
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const filteredBooks = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.qitab_id.toLowerCase().includes(q) ||
        (b.author ?? "").toLowerCase().includes(q) ||
        (b.type_name ?? "").toLowerCase().includes(q),
    );
  }, [books, bookQuery]);

  const availableBooks = useMemo(
    () => books.filter((b) => b.available > 0),
    [books],
  );

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-[#0b3d2e]">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Add qitab</CardTitle>
              <CardDescription>
                Name, Qitab ID, author, and type. Create new types as needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fd = new FormData(form);
                  const typedNew = addingType ? newTypeName.trim() : "";
                  setPendingAction("add");
                  startTransition(async () => {
                    try {
                      const result = await addLibraryBookAction({
                        vendor_id: vendorId,
                        branch_id: branchId,
                        title: String(fd.get("title") ?? ""),
                        qitab_id: String(fd.get("qitab_id") ?? ""),
                        author: String(fd.get("author") ?? "") || undefined,
                        type_id: typedNew ? null : typeId || null,
                        new_type_name: typedNew || null,
                        copies_total: Number(fd.get("copies_total") ?? 1),
                        notes: String(fd.get("notes") ?? "") || undefined,
                      });
                      setMessage(result.error ? result.error : "Book added");
                      if (!result.error) {
                        form.reset();
                        setAddingType(false);
                        setNewTypeName("");
                        router.refresh();
                      }
                    } finally {
                      setPendingAction(null);
                    }
                  });
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="title">Name</Label>
                  <Input id="title" name="title" required placeholder="Book name" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="qitab_id">Qitab ID</Label>
                  <Input
                    id="qitab_id"
                    name="qitab_id"
                    required
                    placeholder="e.g. Q-001"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="author">Author</Label>
                  <Input id="author" name="author" placeholder="Author name" />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  {!addingType ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        className="h-10 w-full rounded-lg border border-input bg-background px-2 md:h-9"
                        value={typeId}
                        onChange={(e) => setTypeId(e.target.value)}
                      >
                        <option value="">No type</option>
                        {bookTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAddingType(true)}
                      >
                        Add type
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="New type name"
                        required
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          pending={pending && pendingAction === "addType"}
                          pendingLabel="Saving…"
                          disabled={pending || !newTypeName.trim()}
                          onClick={() => {
                            setPendingAction("addType");
                            startTransition(async () => {
                              try {
                                const result = await addLibraryBookTypeAction({
                                  vendor_id: vendorId,
                                  branch_id: branchId,
                                  name: newTypeName,
                                });
                                setMessage(
                                  result.error ? result.error : "Type added",
                                );
                                if (!result.error) {
                                  setAddingType(false);
                                  setNewTypeName("");
                                  if (result.id) setTypeId(result.id);
                                  router.refresh();
                                }
                              } finally {
                                setPendingAction(null);
                              }
                            });
                          }}
                        >
                          Save type
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setAddingType(false);
                            setNewTypeName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-[#5a6f65]">
                        Or leave the name filled and submit the book — the type
                        is created automatically.
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="copies_total">Copies</Label>
                  <Input
                    id="copies_total"
                    name="copies_total"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input id="notes" name="notes" />
                </div>
                <Button
                  type="submit"
                  pending={pending && pendingAction === "add"}
                  pendingLabel="Saving…"
                  disabled={pending || !vendorId || !branchId}
                  className="bg-[#0b3d2e]"
                >
                  Add book
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Borrow</CardTitle>
              <CardDescription>
                Assign an available qitab to a student.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPendingAction("borrow");
                  startTransition(async () => {
                    try {
                      const result = await borrowLibraryBookAction({
                        book_id: borrowBookId,
                        student_id: borrowStudentId,
                      });
                      setMessage(result.error ? result.error : "Borrowed");
                      if (!result.error) {
                        setBorrowStudentId("");
                        router.refresh();
                      }
                    } finally {
                      setPendingAction(null);
                    }
                  });
                }}
              >
                <div className="space-y-1">
                  <Label>Book</Label>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-background px-2 md:h-9"
                    value={borrowBookId}
                    onChange={(e) => setBorrowBookId(e.target.value)}
                    required
                  >
                    {availableBooks.length === 0 ? (
                      <option value="">No copies available</option>
                    ) : (
                      availableBooks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} · {b.qitab_id}
                          {b.author ? ` · ${b.author}` : ""}
                          {b.type_name ? ` · ${b.type_name}` : ""} (
                          {b.available} avail)
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <StudentSearchSelect
                  students={students}
                  value={borrowStudentId}
                  onChange={setBorrowStudentId}
                  required
                />
                <Button
                  type="submit"
                  pending={pending && pendingAction === "borrow"}
                  pendingLabel="Borrowing…"
                  disabled={
                    pending ||
                    !borrowBookId ||
                    !borrowStudentId ||
                    availableBooks.length === 0
                  }
                  variant="outline"
                >
                  Borrow
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Books</CardTitle>
          <CardDescription>
            Search by name, Qitab ID, author, or type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={bookQuery}
            onChange={(e) => setBookQuery(e.target.value)}
            placeholder="Search name, Qitab ID, author, type…"
          />
          <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-[#0b3d2e]/10 text-[#5a6f65]">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Qitab ID</th>
                  <th className="px-3 py-2.5 font-medium">Author</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((b) => (
                  <tr key={b.id} className="border-b border-[#0b3d2e]/5">
                    <td className="px-3 py-3 font-medium text-[#0b3d2e]">
                      {b.title}
                    </td>
                    <td className="px-3 py-3">{b.qitab_id}</td>
                    <td className="px-3 py-3">{b.author || "—"}</td>
                    <td className="px-3 py-3">{b.type_name || "—"}</td>
                    <td className="px-3 py-3">
                      {b.available}/{b.copies_total}
                    </td>
                  </tr>
                ))}
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-[#5a6f65]">
                      No books match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Loans</CardTitle>
              <CardDescription>
                Who borrowed what, and how many days out.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={tab === "active" ? "default" : "outline"}
                className={tab === "active" ? "bg-[#0b3d2e]" : ""}
                onClick={() => setTab("active")}
              >
                Active
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tab === "history" ? "default" : "outline"}
                className={tab === "history" ? "bg-[#0b3d2e]" : ""}
                onClick={() => setTab("history")}
              >
                History
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(tab === "active" ? activeLoans : returnedLoans).map((loan) => (
            <div
              key={loan.id}
              className="flex flex-col gap-2 rounded-lg border border-[#0b3d2e]/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-[#0b3d2e]">
                  {loan.book_title}{" "}
                  <span className="font-normal text-[#5a6f65]">
                    · {loan.book_qitab_id}
                  </span>
                </p>
                <p className="text-xs text-[#5a6f65]">
                  {[loan.book_author, loan.book_type_name]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                <p className="text-sm">
                  {loan.student_name}{" "}
                  <span className="text-[#5a6f65]">({loan.admission_no})</span>
                </p>
                <p className="text-xs text-[#5a6f65]">
                  Borrowed {formatDate(loan.borrowed_at)} ·{" "}
                  {daysBorrowed(loan.borrowed_at, loan.returned_at)} day
                  {daysBorrowed(loan.borrowed_at, loan.returned_at) === 1
                    ? ""
                    : "s"}
                  {loan.returned_at
                    ? ` · Returned ${formatDate(loan.returned_at)}`
                    : ""}
                </p>
              </div>
              {tab === "active" && canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  pending={pending && pendingAction === loan.id}
                  pendingLabel="Returning…"
                  disabled={pending}
                  onClick={() => {
                    setPendingAction(loan.id);
                    startTransition(async () => {
                      try {
                        const result = await returnLibraryBookAction({
                          loan_id: loan.id,
                        });
                        setMessage(result.error ? result.error : "Returned");
                        if (!result.error) router.refresh();
                      } finally {
                        setPendingAction(null);
                      }
                    });
                  }}
                >
                  Return
                </Button>
              ) : null}
            </div>
          ))}
          {(tab === "active" ? activeLoans : returnedLoans).length === 0 ? (
            <p className="text-sm text-[#5a6f65]">
              {tab === "active" ? "No active loans." : "No returned loans yet."}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
