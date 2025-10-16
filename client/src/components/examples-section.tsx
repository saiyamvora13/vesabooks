import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

const featuredBooks = [
  {
    title: "Space Adventure with Alex",
    description: "A journey through the stars to find a lost robot friend",
    author: "Emily Chen",
    likes: 234,
    views: 1200,
    image: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400",
  },
  {
    title: "The Ocean Discovery",
    description: "Diving deep to explore coral reefs and meet sea creatures",
    author: "Michael Park",
    likes: 189,
    views: 892,
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400",
  },
  {
    title: "Forest Friends Forever",
    description: "Making friends with woodland animals in an enchanted forest",
    author: "Sarah Miller",
    likes: 312,
    views: 1500,
    image: "https://images.unsplash.com/photo-1511497584788-876760111969?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400",
  },
];

export default function ExamplesSection() {
  const { t } = useTranslation();
  
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('home.examples.title')}</h2>
          <p className="text-lg text-muted-foreground">
            {t('home.examples.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {featuredBooks.map((book, index) => (
            <Card key={index} className="story-card rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl active:scale-[0.98] touch-manipulation">
              <div className="aspect-[3/2] relative overflow-hidden">
                <img 
                  src={book.image} 
                  alt={`Cover image for ${book.title} by ${book.author}`} 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-2 line-clamp-2">{book.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{book.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-primary to-secondary rounded-full"></div>
                    <span className="text-xs sm:text-sm font-medium">{book.author}</span>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm">
                    <span className="flex items-center text-muted-foreground">
                      <i className="fas fa-heart mr-1"></i>
                      <span className="font-medium">{book.likes}</span>
                    </span>
                    <span className="flex items-center text-muted-foreground">
                      <i className="fas fa-eye mr-1"></i>
                      <span>{book.views}</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
