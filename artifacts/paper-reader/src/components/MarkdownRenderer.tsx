import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-stone dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-3xl font-serif font-semibold mt-8 mb-4 pb-2 border-b border-border/50 text-foreground" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-2xl font-serif font-medium mt-8 mb-4 text-foreground/90" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-xl font-serif font-medium mt-6 mb-3 text-foreground/80" {...props} />,
          p: ({node, ...props}) => <p className="leading-relaxed text-foreground/80 mb-4" {...props} />,
          a: ({node, ...props}) => <a className="text-primary hover:text-primary/80 underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-all" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary/40 pl-4 py-1 italic bg-primary/5 rounded-r-lg my-6 text-muted-foreground" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc list-outside pl-6 space-y-2 mb-6" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal list-outside pl-6 space-y-2 mb-6" {...props} />,
          li: ({node, ...props}) => <li className="text-foreground/80 pl-1 marker:text-primary/60" {...props} />,
          code: ({node, inline, ...props}: any) => 
            inline ? 
              <code className="bg-secondary/80 text-secondary-foreground px-1.5 py-0.5 rounded-md font-mono text-sm border border-border/50" {...props} /> : 
              <code className="block bg-secondary/80 text-secondary-foreground p-4 rounded-xl font-mono text-sm overflow-x-auto border border-border shadow-inner" {...props} />,
          pre: ({node, ...props}) => <pre className="my-6" {...props} />,
          img: ({node, src, alt, ...props}: any) => (
            <figure className="my-8 not-prose">
              <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                <img
                  src={src}
                  alt={alt}
                  className="w-full h-auto object-contain max-h-[480px]"
                  loading="lazy"
                  {...props}
                />
              </div>
              {alt && (
                <figcaption className="text-xs text-muted-foreground text-center mt-2 px-2 leading-relaxed italic">
                  {alt}
                </figcaption>
              )}
            </figure>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
