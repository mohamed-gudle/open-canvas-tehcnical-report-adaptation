import { NextResponse } from "next/server";
import { listDocumentOptions } from "@opencanvas/agents/dist/docs/index.js";

export async function GET() {
  try {
    const options = await listDocumentOptions();
    return NextResponse.json({ options });
  } catch (error) {
    console.error("Failed to load document options", error);
    return NextResponse.json(
      {
        error: "Failed to load document options",
      },
      { status: 500 }
    );
  }
}
